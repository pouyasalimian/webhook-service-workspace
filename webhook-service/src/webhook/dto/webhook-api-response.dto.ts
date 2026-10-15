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

export class CreateWebhookSubscriptionResponseDto extends WebhookSubscriptionResponseDto {
  @ApiProperty({
    description:
      'Shared HMAC-SHA256 secret. Store it securely; it is returned only when the subscription is created or its secret is rotated.',
    example: '4b2c...64-hex-characters...a91f',
  })
  signingSecret!: string;
}

export class RotateWebhookSubscriptionSecretResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: 'The newly generated shared HMAC-SHA256 secret.',
    example: '4b2c...64-hex-characters...a91f',
  })
  signingSecret!: string;
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
