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
import { PaymentEventIngestResponseDto } from '../dto/payment-event-response.dto.js';
import { ReceivePaymentEventDto } from '../dto/receive-payment-event.dto.js';
import { PaymentEventService } from '../services/payment-event.service.js';

@ApiTags('Payment Events')
@Controller('payment-events')
export class PaymentEventsController {
  constructor(private readonly paymentEventService: PaymentEventService) {}

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
    const result = await this.paymentEventService.ingest(dto);
    response.status(result.duplicate ? HttpStatus.OK : HttpStatus.ACCEPTED);
    return result;
  }
}
