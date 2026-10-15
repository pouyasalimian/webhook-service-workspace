import { IsEnum, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { WebhookEventType } from '../../generated/prisma/enums.js';

export class CreateSubscriptionDto {
  @IsEnum(WebhookEventType)
  eventType!: WebhookEventType;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @IsUrl()
  endpoint!: string;
}
