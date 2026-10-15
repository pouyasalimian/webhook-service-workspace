import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import {
  WEBHOOK_QUEUE,
  WEBHOOK_QUEUE_NAME,
  WEBHOOK_REDIS_CONNECTION,
  type WebhookDeliveryJobData,
} from './webhook-queue.constants.js';
import { WebhookQueueService } from './webhook-queue.service.js';

@Module({
  providers: [
    {
      provide: WEBHOOK_REDIS_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.getOrThrow<string>('REDIS_HOST', '127.0.0.1');
        const port = Number(
          config.getOrThrow<string | number>('REDIS_PORT', 6379),
        );
        const password = config.get<string>('REDIS_PASSWORD');

        return new Redis({
          host,
          port,
          ...(password ? { password } : {}),
          maxRetriesPerRequest: 1,
        });
      },
    },
    {
      provide: WEBHOOK_QUEUE,
      inject: [WEBHOOK_REDIS_CONNECTION],
      useFactory: (connection: Redis) =>
        new Queue<WebhookDeliveryJobData>(WEBHOOK_QUEUE_NAME, { connection }),
    },
    WebhookQueueService,
  ],
  exports: [WebhookQueueService],
})
export class WebhookQueueModule {}
