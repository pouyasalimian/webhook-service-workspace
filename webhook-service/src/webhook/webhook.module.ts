import { Module } from '@nestjs/common';
import { PaymentEventsController } from './controllers/payment-events.controller.js';
import { WebhookSubscriptionsController } from './controllers/webhook-subscriptions.controller.js';
import { WebhookEventService } from './services/webhook-event.service.js';
import { WebhookSubscriptionService } from './services/webhook-subscription.service.js';

@Module({
  controllers: [PaymentEventsController, WebhookSubscriptionsController],
  providers: [WebhookEventService, WebhookSubscriptionService],
})
export class WebhookModule {}
