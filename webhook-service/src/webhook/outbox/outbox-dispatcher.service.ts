import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { WebhookQueueService } from '../queue/services/webhook-queue.service.js';
import {
  OUTBOX_BATCH_SIZE,
  OUTBOX_MESSAGE_TYPE,
} from '../constants/outbox.constant.js';

@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private readonly pollIntervalMs: number;
  private interval?: NodeJS.Timeout;
  private currentPoll?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: WebhookQueueService,
    config: ConfigService,
  ) {
    this.pollIntervalMs = Number(config.get('OUTBOX_POLL_INTERVAL_MS', 1000));
    if (!Number.isSafeInteger(this.pollIntervalMs) || this.pollIntervalMs < 1) {
      throw new Error('OUTBOX_POLL_INTERVAL_MS must be a positive integer');
    }
  }

  onModuleInit() {
    void this.pollSafely();
    this.interval = setInterval(
      () => void this.pollSafely(),
      this.pollIntervalMs,
    );
  }

  async onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
    await this.currentPoll;
  }

  private pollSafely(): Promise<void> {
    if (this.currentPoll) return this.currentPoll;

    this.currentPoll = this.dispatchBatch()
      .catch((error: unknown) => {
        this.logger.error(`Outbox poll failed: ${this.errorMessage(error)}`);
      })
      .finally(() => {
        this.currentPoll = undefined;
      });

    return this.currentPoll;
  }

  private async dispatchBatch(): Promise<void> {
    const messages = await this.prisma.outboxMessage.findMany({
      where: { publishedAt: null, type: OUTBOX_MESSAGE_TYPE },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: OUTBOX_BATCH_SIZE,
      select: { id: true, webhookId: true },
    });

    for (const message of messages) {
      try {
        await this.queue.enqueueDelivery(message.webhookId);
      } catch (error) {
        this.logger.warn(
          `Outbox enqueue failed for ${message.id}: ${this.errorMessage(error)}`,
        );
        break;
      }

      try {
        const result = await this.prisma.outboxMessage.updateMany({
          where: { id: message.id, publishedAt: null },
          data: { publishedAt: new Date() },
        });
        if (result.count === 1) {
          this.logger.log(
            `Published outbox message ${message.id} for webhook ${message.webhookId}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Outbox publish timestamp update failed for ${message.id}: ${this.errorMessage(error)}`,
        );
      }
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
