import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { WebhookEventType } from '../../generated/prisma/enums.js';

export class CreateSubscriptionDto {
  @ApiProperty({
    enum: WebhookEventType,
    example: WebhookEventType.PAYMENT_COMPLETED,
  })
  @IsEnum(WebhookEventType)
  eventType!: WebhookEventType;

  @ApiProperty({
    example: 'https://consumer.example.com/webhooks/payments',
    maxLength: 2048,
    format: 'uri',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @IsUrl()
  endpoint!: string;
}
