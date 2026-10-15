import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookQueueService } from './services/webhook-queue.service.js';
import { WEBHOOK_QUEUE_NAME } from '../constants/queue.constant.js';

@Module({
  imports: [BullModule.registerQueue({ name: WEBHOOK_QUEUE_NAME })],
  providers: [WebhookQueueService],
  exports: [WebhookQueueService],
})
export class WebhookQueueModule {}
