import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReceivePaymentEventDto } from '../dto/receive-payment-event.dto.js';
import { WebhookEventService } from '../services/webhook-event.service.js';

@Controller('payment-events')
export class PaymentEventsController {
  constructor(private readonly webhookEventService: WebhookEventService) {}

  @Post()
  async receive(
    @Body() dto: ReceivePaymentEventDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.webhookEventService.ingest(dto);
    response.status(result.duplicate ? HttpStatus.OK : HttpStatus.ACCEPTED);
    return result;
  }
}
