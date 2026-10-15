import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WEBHOOK_QUEUE_NAME } from './webhook-queue.constants.js';
import { WebhookQueueService } from './webhook-queue.service.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE_NAME }),
  ],
  providers: [WebhookQueueService],
  exports: [WebhookQueueService],
})
export class WebhookQueueModule {}
