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
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  eventId!: string;

  @IsEnum(WebhookEventType)
  type!: WebhookEventType;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
