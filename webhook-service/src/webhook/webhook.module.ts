import { Module } from '@nestjs/common';
import { PaymentEventsController } from './controllers/payment-events.controller.js';
import { WebhookSubscriptionsController } from './controllers/webhook-subscriptions.controller.js';
import { WebhookEventService } from './services/webhook-event.service.js';
import { WebhookSubscriptionService } from './services/webhook-subscription.service.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { WebhookHttpClientService } from './http/webhook-http-client.service.js';
import { WebhookProcessor } from './queue/webhook.processor.js';
import { WebhookQueueModule } from './queue/webhook-queue.module.js';
import { WebhookReconciliationService } from './queue/webhook-reconciliation.service.js';
import { WebhookHistoryController } from './controllers/webhook-history.controller.js';
import { WebhookHistoryService } from './services/webhook-history.service.js';

@Module({
  imports: [OutboxModule, WebhookQueueModule],
  controllers: [
    PaymentEventsController,
    WebhookSubscriptionsController,
    WebhookHistoryController,
  ],
  providers: [
    WebhookEventService,
    WebhookSubscriptionService,
    WebhookHttpClientService,
    WebhookProcessor,
    WebhookReconciliationService,
    WebhookHistoryService,
  ],
})
export class WebhookModule {}
