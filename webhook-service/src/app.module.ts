import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { WebhookRedisConnection } from './webhook/queue/configs/webhook-redis-connection.js';
import { WebhookModule } from './webhook/webhook.module.js';

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
    WebhookModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
