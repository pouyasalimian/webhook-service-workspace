import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { RedisConnectionService } from './infrastructure/redis/redis-connection.service.js';
import { WebhookModule } from './webhook/webhook.module.js';
import { PaymentEventsModule } from './payment-events/payment-events.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    InfrastructureModule,
    BullModule.forRootAsync({
      imports: [ConfigModule, InfrastructureModule],
      inject: [RedisConnectionService],
      useFactory: (redis: RedisConnectionService) => ({
        connection: redis.client,
      }),
    }),
    WebhookModule,
    PaymentEventsModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
