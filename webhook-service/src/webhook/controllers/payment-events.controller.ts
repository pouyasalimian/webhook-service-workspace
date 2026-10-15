import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ReceivePaymentEventDto } from '../dto/receive-payment-event.dto.js';
import { PaymentEventIngestResponseDto } from '../dto/webhook-api-response.dto.js';
import { WebhookEventService } from '../services/webhook-event.service.js';

@ApiTags('Payment Events')
@Controller('payment-events')
export class PaymentEventsController {
  constructor(private readonly webhookEventService: WebhookEventService) {}

  @Post()
  @ApiOperation({
    summary: 'Accept a payment event',
    description:
      'Persists the event and atomically creates logical deliveries and outbox messages for matching active subscriptions.',
  })
  @ApiAcceptedResponse({
    description:
      'Event accepted; deliveries were created once for matching subscriptions.',
    type: PaymentEventIngestResponseDto,
  })
  @ApiOkResponse({
    description:
      'This eventId was already accepted; no additional deliveries were created.',
    type: PaymentEventIngestResponseDto,
  })
  @ApiBadRequestResponse({ description: 'The request body is invalid.' })
  async receive(
    @Body() dto: ReceivePaymentEventDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.webhookEventService.ingest(dto);
    response.status(result.duplicate ? HttpStatus.OK : HttpStatus.ACCEPTED);
    return result;
  }
}
