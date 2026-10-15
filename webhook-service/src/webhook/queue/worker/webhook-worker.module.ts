import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { InfrastructureModule } from '../../../infrastructure/infrastructure.module.js';
import { WebhookHttpClientService } from '../../http/webhook-http-client.service.js';
import { WebhookRedisConnection } from '../configs/webhook-redis-connection.js';
import { WebhookQueueModule } from '../webhook-queue.module.js';
import { WebhookProcessor } from './webhook.processor.js';

@Module({
  imports: [
    InfrastructureModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      extraProviders: [WebhookRedisConnection],
      inject: [WebhookRedisConnection],
      useFactory: (redis: WebhookRedisConnection) => ({
        connection: redis.client,
      }),
    }),
    WebhookQueueModule,
  ],
  providers: [WebhookHttpClientService, WebhookProcessor],
})
export class WebhookWorkerModule {}
