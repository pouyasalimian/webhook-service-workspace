import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  WebhookAttemptStatus,
  WebhookFailureReason,
  WebhookStatus,
} from '../../../generated/prisma/enums.js';
import { WebhookQueueService } from './webhook-queue.service.js';
import {
  MAX_DELIVERY_ATTEMPTS,
  getWebhookRetryDelayMs,
} from '../webhook-retry.policy.js';

const RECONCILIATION_BATCH_SIZE = 100;
const PROCESSING_SAFETY_MARGIN_MS = 30_000;

@Injectable()
export class WebhookReconciliationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WebhookReconciliationService.name);
  private readonly reconciliationIntervalMs: number;
  private readonly staleProcessingAfterMs: number;
  private interval?: NodeJS.Timeout;
  private currentRun?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: WebhookQueueService,
    config: ConfigService,
  ) {
    this.reconciliationIntervalMs = Number(
      config.get('RECONCILIATION_INTERVAL_MS', 30_000),
    );
    const httpTimeoutMs = Number(config.get('WEBHOOK_HTTP_TIMEOUT_MS', 10_000));

    if (
      !Number.isSafeInteger(this.reconciliationIntervalMs) ||
      this.reconciliationIntervalMs < 1
    ) {
      throw new Error('RECONCILIATION_INTERVAL_MS must be a positive integer');
    }
    if (!Number.isSafeInteger(httpTimeoutMs) || httpTimeoutMs < 1) {
      throw new Error('WEBHOOK_HTTP_TIMEOUT_MS must be a positive integer');
    }

    this.staleProcessingAfterMs = httpTimeoutMs + PROCESSING_SAFETY_MARGIN_MS;
  }

  onModuleInit() {
    void this.reconcileSafely();
    this.interval = setInterval(
      () => void this.reconcileSafely(),
      this.reconciliationIntervalMs,
    );
  }

  async onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
    await this.currentRun;
  }

  private reconcileSafely(): Promise<void> {
    if (this.currentRun) {
      return this.currentRun;
    }

    this.currentRun = this.reconcile()
      .catch((error: unknown) => {
        this.logger.error(
          `Webhook reconciliation failed: ${this.errorMessage(error)}`,
        );
      })
      .finally(() => {
        this.currentRun = undefined;
      });

    return this.currentRun;
  }

  private async reconcile() {
    await this.failExhaustedPendingDeliveries();
    await this.recoverStaleProcessingDeliveries();
    await this.enqueueEligiblePendingDeliveries();
  }

  private failExhaustedPendingDeliveries() {
    return this.prisma.webhook.updateMany({
      where: {
        status: WebhookStatus.PENDING,
        attemptCount: { gte: MAX_DELIVERY_ATTEMPTS },
      },
      data: {
        status: WebhookStatus.FAILED,
        failureReason: WebhookFailureReason.INTERNAL_ERROR,
        nextAttemptAt: null,
        processingStartedAt: null,
      },
    });
  }

  private async recoverStaleProcessingDeliveries() {
    const staleBefore = new Date(Date.now() - this.staleProcessingAfterMs);
    const staleDeliveries = await this.prisma.webhook.findMany({
      where: {
        status: WebhookStatus.PROCESSING,
        processingStartedAt: { lte: staleBefore },
      },
      orderBy: [{ processingStartedAt: 'asc' }, { id: 'asc' }],
      take: RECONCILIATION_BATCH_SIZE,
      select: { id: true, attemptCount: true },
    });

    for (const webhook of staleDeliveries) {
      try {
        const recovered = await this.recoverStaleDelivery(
          webhook.id,
          webhook.attemptCount,
          staleBefore,
        );
        if (recovered) {
          this.logger.warn(
            `Recovered stale webhook delivery ${webhook.id} at attempt ${webhook.attemptCount}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Could not recover stale webhook ${webhook.id}: ${this.errorMessage(error)}`,
        );
      }
    }
  }

  private recoverStaleDelivery(
    webhookId: string,
    attemptNumber: number,
    staleBefore: Date,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const completedAt = new Date();
      const retryDelayMs = getWebhookRetryDelayMs(attemptNumber);

      const updated = await transaction.webhook.updateMany({
        where: {
          id: webhookId,
          status: WebhookStatus.PROCESSING,
          processingStartedAt: { lte: staleBefore },
        },
        data: {
          status:
            retryDelayMs === undefined
              ? WebhookStatus.FAILED
              : WebhookStatus.PENDING,
          failureReason: WebhookFailureReason.INTERNAL_ERROR,
          nextAttemptAt:
            retryDelayMs === undefined
              ? null
              : new Date(completedAt.getTime() + retryDelayMs),
          processingStartedAt: null,
        },
      });

      if (updated.count !== 1) {
        return false;
      }

      const attempt = await transaction.webhookDelivery.findFirst({
        where: {
          webhookId,
          attemptNumber,
          status: WebhookAttemptStatus.PENDING,
        },
        select: { id: true, startedAt: true },
      });

      if (attempt) {
        const attemptUpdated = await transaction.webhookDelivery.updateMany({
          where: { id: attempt.id, status: WebhookAttemptStatus.PENDING },
          data: {
            status: WebhookAttemptStatus.FAILED,
            failureReason: WebhookFailureReason.INTERNAL_ERROR,
            failureDetails:
              'Worker stopped before recording the attempt result',
            durationMs: Math.max(
              0,
              completedAt.getTime() - attempt.startedAt.getTime(),
            ),
            completedAt,
          },
        });
        if (attemptUpdated.count !== 1) {
          throw new Error(
            'Attempt changed while stale delivery was being recovered',
          );
        }
      }

      return true;
    });
  }

  private async enqueueEligiblePendingDeliveries() {
    const now = new Date();
    const deliveries = await this.prisma.webhook.findMany({
      where: {
        status: WebhookStatus.PENDING,
        attemptCount: { lt: MAX_DELIVERY_ATTEMPTS },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: RECONCILIATION_BATCH_SIZE,
      select: { id: true },
    });

    for (const webhook of deliveries) {
      try {
        await this.queue.enqueueDelivery(webhook.id);
      } catch (error) {
        this.logger.warn(
          `Could not re-enqueue pending webhook ${webhook.id}: ${this.errorMessage(error)}`,
        );
      }
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
