import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  WEBHOOK_QUEUE,
  WEBHOOK_QUEUE_NAME,
  type WebhookDeliveryJobData,
} from './webhook-queue.constants.js';
import { WebhookQueueService } from './webhook-queue.service.js';

@Module({
  providers: [
    {
      provide: WEBHOOK_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.getOrThrow<string>('REDIS_HOST', '127.0.0.1');
        const port = Number(
          config.getOrThrow<string | number>('REDIS_PORT', 6379),
        );
        const password = config.get<string>('REDIS_PASSWORD');

        return new Queue<WebhookDeliveryJobData>(WEBHOOK_QUEUE_NAME, {
          connection: {
            host,
            port,
            ...(password ? { password } : {}),
            maxRetriesPerRequest: 1,
          },
        });
      },
    },
    WebhookQueueService,
  ],
  exports: [WebhookQueueService],
})
export class WebhookQueueModule {}
