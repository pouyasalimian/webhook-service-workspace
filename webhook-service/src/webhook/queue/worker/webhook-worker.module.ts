import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { InfrastructureModule } from '../../../infrastructure/infrastructure.module.js';
import { RedisConnectionService } from '../../../infrastructure/redis/redis-connection.service.js';
import { WebhookHttpClientService } from '../../http/webhook-http-client.service.js';
import { WebhookQueueModule } from '../webhook-queue.module.js';
import { WebhookProcessor } from './webhook.processor.js';

@Module({
  imports: [
    InfrastructureModule,
    BullModule.forRootAsync({
      imports: [InfrastructureModule, ConfigModule],
      inject: [RedisConnectionService],
      useFactory: (redis: RedisConnectionService) => ({
        connection: redis.client,
      }),
    }),
    WebhookQueueModule,
  ],
  providers: [WebhookHttpClientService, WebhookProcessor],
})
export class WebhookWorkerModule {}
