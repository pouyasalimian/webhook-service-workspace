import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WebhookEventType } from '../../generated/prisma/enums.js';

export class ReceivePaymentEventDto {
  @ApiProperty({ example: 'payment-event-123', minLength: 1, maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  eventId!: string;

  @ApiProperty({
    enum: WebhookEventType,
    example: WebhookEventType.PAYMENT_COMPLETED,
  })
  @IsEnum(WebhookEventType)
  type!: WebhookEventType;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-10-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  payload!: Record<string, unknown>;
}
