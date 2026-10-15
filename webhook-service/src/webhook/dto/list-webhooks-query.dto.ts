import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  WebhookEventType,
  WebhookStatus,
} from '../../generated/prisma/enums.js';

export class ListWebhooksQueryDto {
  @ApiPropertyOptional({ enum: WebhookStatus })
  @IsOptional()
  @IsEnum(WebhookStatus)
  status?: WebhookStatus;

  @ApiPropertyOptional({ enum: WebhookEventType })
  @IsOptional()
  @IsEnum(WebhookEventType)
  eventType?: WebhookEventType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @ApiPropertyOptional({ type: Number, default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @ApiPropertyOptional({ type: Number, default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
