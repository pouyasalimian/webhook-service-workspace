import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  WEBHOOK_JOB_NAME,
  WEBHOOK_QUEUE,
  type WebhookDeliveryJobData,
} from './webhook-queue.constants.js';

@Injectable()
export class WebhookQueueService implements OnModuleDestroy {
  constructor(
    @Inject(WEBHOOK_QUEUE)
    private readonly queue: Queue<WebhookDeliveryJobData>,
  ) {}

  enqueueDelivery(webhookId: string) {
    return this.queue.add(
      WEBHOOK_JOB_NAME,
      { webhookId },
      { jobId: `webhook-${webhookId}` },
    );
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
