import { Module } from '@nestjs/common';
import { WebhookQueueModule } from '../queue/webhook-queue.module.js';
import { OutboxDispatcherService } from './outbox-dispatcher.service.js';

@Module({
  imports: [WebhookQueueModule],
  providers: [OutboxDispatcherService],
})
export class OutboxModule {}
