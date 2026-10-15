import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import {
  WEBHOOK_JOB_NAME,
  WEBHOOK_QUEUE,
  WEBHOOK_REDIS_CONNECTION,
  type WebhookDeliveryJobData,
} from './webhook-queue.constants.js';

@Injectable()
export class WebhookQueueService implements OnModuleDestroy {
  constructor(
    @Inject(WEBHOOK_QUEUE)
    private readonly queue: Queue<WebhookDeliveryJobData>,
    @Inject(WEBHOOK_REDIS_CONNECTION)
    private readonly redis: Redis,
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
    await this.redis.quit();
  }
}
