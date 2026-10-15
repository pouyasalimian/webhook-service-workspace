import { Module } from '@nestjs/common';
import { PaymentEventsController } from './controllers/payment-events.controller.js';
import { PaymentEventService } from './services/payment-event.service.js';

@Module({
  controllers: [PaymentEventsController],
  providers: [PaymentEventService],
})
export class PaymentEventsModule {}
