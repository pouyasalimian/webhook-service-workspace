import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  WEBHOOK_JOB_NAME,
  WEBHOOK_QUEUE_NAME,
  type WebhookDeliveryJobData,
} from './webhook-queue.constants.js';

@Injectable()
export class WebhookQueueService {
  constructor(
    @InjectQueue(WEBHOOK_QUEUE_NAME)
    private readonly queue: Queue<WebhookDeliveryJobData>,
  ) {}

  enqueueDelivery(webhookId: string) {
    return this.queue.add(
      WEBHOOK_JOB_NAME,
      { webhookId },
      { jobId: `webhook-${webhookId}` },
    );
  }
}
