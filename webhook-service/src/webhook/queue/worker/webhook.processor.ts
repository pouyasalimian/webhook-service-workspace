import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  WebhookAttemptStatus,
  WebhookFailureReason,
  WebhookStatus,
} from '../../../generated/prisma/enums.js';
import {
  WebhookHttpClientService,
  WebhookTransportError,
} from '../../http/webhook-http-client.service.js';
import {
  MAX_DELIVERY_ATTEMPTS,
  getWebhookRetryDelayMs,
  webhookRetryBackoff,
} from '../webhook-retry.policy.js';
import { type WebhookDeliveryJobData } from '../types/webhook-job-data.type.js';
import {
  WEBHOOK_JOB_NAME,
  WEBHOOK_QUEUE_NAME,
} from '../../constants/queue.constant.js';

@Processor(WEBHOOK_QUEUE_NAME, {
  concurrency: 2,
  settings: { backoffStrategy: webhookRetryBackoff },
})
@Injectable()
export class WebhookProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpClient: WebhookHttpClientService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  onApplicationBootstrap() {
    const concurrency = Number(
      this.config.get('WEBHOOK_WORKER_CONCURRENCY', 2),
    );
    if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
      throw new Error('WEBHOOK_WORKER_CONCURRENCY must be a positive integer');
    }

    this.worker.concurrency = concurrency;
  }

  async process(job: Job<WebhookDeliveryJobData, unknown, string>) {
    if (
      job.name !== WEBHOOK_JOB_NAME ||
      typeof job.data?.webhookId !== 'string'
    ) {
      throw new Error(`Invalid webhook delivery job: ${job.name}`);
    }

    return this.processDelivery(job.data.webhookId);
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error) {
    this.logger.error(`BullMQ worker error: ${error.message}`);
  }

  @OnWorkerEvent('failed')
  onJobFailed(
    job: Job<WebhookDeliveryJobData, unknown, string> | undefined,
    error: Error,
  ) {
    this.logger.error(
      `BullMQ job failed: jobId=${job?.id ?? 'unknown'} webhookId=${job?.data.webhookId ?? 'unknown'} error=${error.message}`,
    );
  }

  private async processDelivery(webhookId: string) {
    const attempt = await this.claimAndCreateAttempt(webhookId);
    if (!attempt) {
      return { skipped: true };
    }

    const event = {
      id: attempt.webhook.event.sourceEventId,
      type: attempt.webhook.eventType,
      occurredAt: (
        attempt.webhook.event.occurredAt ?? attempt.webhook.event.receivedAt
      ).toISOString(),
      data: attempt.webhook.payload,
    };

    let result;
    try {
      result = await this.httpClient.post(
        attempt.webhook.endpoint,
        attempt.webhook.id,
        attempt.webhook.subscription.signingSecret,
        event,
      );
    } catch (error) {
      const reason =
        error instanceof WebhookTransportError
          ? error.reason
          : WebhookFailureReason.INTERNAL_ERROR;

      const details =
        error instanceof WebhookTransportError
          ? error.message
          : 'Delivery request failed unexpectedly';

      return this.failAttempt(attempt, reason, details);
    }

    if (result.statusCode < 200 || result.statusCode >= 300) {
      return this.failAttempt(
        attempt,
        WebhookFailureReason.HTTP_ERROR,
        `HTTP endpoint returned status ${result.statusCode}`,
        result.statusCode,
        result.responseBody,
      );
    }

    await this.recordSuccess(
      attempt,
      result.statusCode,
      result.responseBody,
      result.durationMs,
    );

    this.logger.log(
      `Webhook delivered: webhookId=${webhookId} attempt=${attempt.attemptNumber} status=${result.statusCode} durationMs=${result.durationMs}`,
    );

    return { delivered: true, statusCode: result.statusCode };
  }

  private claimAndCreateAttempt(webhookId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const now = new Date();
      const claimed = await transaction.webhook.updateMany({
        where: {
          id: webhookId,
          status: WebhookStatus.PENDING,
          attemptCount: { lt: MAX_DELIVERY_ATTEMPTS },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        data: {
          status: WebhookStatus.PROCESSING,
          processingStartedAt: now,
          lastAttemptAt: now,
          attemptCount: { increment: 1 },
        },
      });

      if (claimed.count !== 1) {
        return null;
      }

      const webhook = await transaction.webhook.findUnique({
        where: { id: webhookId },
        include: {
          event: {
            select: { sourceEventId: true, occurredAt: true, receivedAt: true },
          },
          subscription: { select: { signingSecret: true } },
        },
      });

      if (!webhook)
        throw new Error('Claimed webhook disappeared before attempt creation');

      const deliveryAttempt = await transaction.webhookDelivery.create({
        data: {
          webhookId,
          attemptNumber: webhook.attemptCount,
          endpointAudit: webhook.endpoint,
          status: WebhookAttemptStatus.PENDING,
        },
        select: { id: true, startedAt: true },
      });

      return {
        id: deliveryAttempt.id,
        startedAt: deliveryAttempt.startedAt,
        attemptNumber: webhook.attemptCount,
        webhook,
      };
    });
  }

  private async recordSuccess(
    attempt: NonNullable<
      Awaited<ReturnType<WebhookProcessor['claimAndCreateAttempt']>>
    >,
    statusCode: number,
    responseBody: string,
    durationMs: number,
  ) {
    const completedAt = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.webhookDelivery.update({
        where: { id: attempt.id },
        data: {
          status: WebhookAttemptStatus.SUCCESS,
          clientHttpStatus: statusCode,
          responseBody,
          durationMs,
          completedAt,
        },
      });

      const updated = await transaction.webhook.updateMany({
        where: { id: attempt.webhook.id, status: WebhookStatus.PROCESSING },
        data: {
          status: WebhookStatus.SUCCESS,
          failureReason: null,
          nextAttemptAt: null,
          processingStartedAt: null,
          succeededAt: completedAt,
        },
      });
      if (updated.count !== 1) {
        throw new Error(
          'Webhook state changed before successful attempt was recorded',
        );
      }
    });
  }

  private async recordFailure(
    attempt: NonNullable<
      Awaited<ReturnType<WebhookProcessor['claimAndCreateAttempt']>>
    >,
    reason: WebhookFailureReason,
    details: string,
    statusCode?: number,
    responseBody?: string,
    retryDelayMs = getWebhookRetryDelayMs(attempt.attemptNumber),
  ) {
    const completedAt = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.webhookDelivery.update({
        where: { id: attempt.id },
        data: {
          status: WebhookAttemptStatus.FAILED,
          failureReason: reason,
          failureDetails: details.slice(0, 2_000),
          clientHttpStatus: statusCode,
          responseBody,
          durationMs: Math.max(
            0,
            completedAt.getTime() - attempt.startedAt.getTime(),
          ),
          completedAt,
        },
      });

      const updated = await transaction.webhook.updateMany({
        where: { id: attempt.webhook.id, status: WebhookStatus.PROCESSING },
        data: {
          status:
            retryDelayMs === undefined
              ? WebhookStatus.FAILED
              : WebhookStatus.PENDING,
          failureReason: reason,
          nextAttemptAt:
            retryDelayMs === undefined
              ? null
              : new Date(completedAt.getTime() + retryDelayMs),
          processingStartedAt: null,
        },
      });

      if (updated.count !== 1) {
        throw new Error(
          'Webhook state changed before failed attempt was recorded',
        );
      }
    });
  }

  private async failAttempt(
    attempt: NonNullable<
      Awaited<ReturnType<WebhookProcessor['claimAndCreateAttempt']>>
    >,
    reason: WebhookFailureReason,
    details: string,
    statusCode?: number,
    responseBody?: string,
  ) {
    const retryDelayMs = getWebhookRetryDelayMs(attempt.attemptNumber);
    await this.recordFailure(
      attempt,
      reason,
      details,
      statusCode,
      responseBody,
      retryDelayMs,
    );

    this.logger.warn(
      `Webhook attempt failed: webhookId=${attempt.webhook.id} attempt=${attempt.attemptNumber} reason=${reason}`,
    );

    if (retryDelayMs === undefined) {
      throw new Error('Webhook delivery attempts exhausted');
    }

    throw new Error('Retryable webhook delivery failure');
  }
}
