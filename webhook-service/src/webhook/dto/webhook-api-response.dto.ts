import { ApiProperty } from '@nestjs/swagger';
import { WebhookEventType } from '../../generated/prisma/enums.js';

export class WebhookSubscriptionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: WebhookEventType, example: 'PAYMENT_COMPLETED' })
  eventType!: WebhookEventType;

  @ApiProperty({ example: 'https://consumer.example.com/webhooks/payments' })
  endpoint!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ format: 'date-time', nullable: true })
  deletedAt!: Date | null;
}

export class WebhookSubscriptionListResponseDto {
  @ApiProperty({ type: [WebhookSubscriptionResponseDto] })
  data!: WebhookSubscriptionResponseDto[];

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 125 })
  total!: number;
}

export class PaymentEventIngestResponseDto {
  @ApiProperty({ example: 'payment-event-123' })
  eventId!: string;

  @ApiProperty({ example: true })
  accepted!: boolean;

  @ApiProperty({ example: 3 })
  deliveriesCreated!: number;

  @ApiProperty({ example: false })
  duplicate!: boolean;
}
