import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  WEBHOOK_JOB_NAME,
  WEBHOOK_QUEUE_NAME,
  type WebhookDeliveryJobData,
} from './webhook-queue.constants.js';
import {
  MAX_DELIVERY_ATTEMPTS,
  WEBHOOK_RETRY_BACKOFF_TYPE,
} from './webhook-retry.policy.js';

@Injectable()
export class WebhookQueueService {
  constructor(
    @InjectQueue(WEBHOOK_QUEUE_NAME)
    private readonly queue: Queue<WebhookDeliveryJobData>,
  ) {}

  enqueueDelivery(webhookId: string) {
    return this.enqueueIfMissing(webhookId);
  }

  private async enqueueIfMissing(webhookId: string) {
    const jobId = `webhook-${webhookId}`;
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (
        [
          'active',
          'delayed',
          'waiting',
          'waiting-children',
          'paused',
          'prioritized',
        ].includes(state)
      ) {
        return existing;
      }

      await existing.remove();
    }

    return this.queue.add(
      WEBHOOK_JOB_NAME,
      { webhookId },
      {
        jobId,
        attempts: MAX_DELIVERY_ATTEMPTS,
        backoff: { type: WEBHOOK_RETRY_BACKOFF_TYPE },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
