import { ApiProperty } from '@nestjs/swagger';
import {
  WebhookAttemptStatus,
  WebhookEventType,
  WebhookFailureReason,
  WebhookStatus,
} from '../../generated/prisma/enums.js';

export class WebhookAttemptSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 1 })
  attemptNumber!: number;

  @ApiProperty({ enum: WebhookAttemptStatus })
  status!: WebhookAttemptStatus;

  @ApiProperty({ type: Number, nullable: true, example: 503 })
  clientHttpStatus!: number | null;

  @ApiProperty({ enum: WebhookFailureReason, nullable: true })
  failureReason!: WebhookFailureReason | null;

  @ApiProperty({ type: Number, nullable: true, example: 250 })
  durationMs!: number | null;

  @ApiProperty({ format: 'date-time' })
  startedAt!: Date;

  @ApiProperty({ format: 'date-time', nullable: true })
  completedAt!: Date | null;
}

export class WebhookAttemptResponseDto extends WebhookAttemptSummaryDto {
  @ApiProperty({ nullable: true })
  failureDetails!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Response body truncated to 4096 characters.',
  })
  responseBody!: string | null;

  @ApiProperty({ example: false })
  responseBodyTruncated!: boolean;
}

export class WebhookDeliveryListItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ format: 'uuid' })
  subscriptionId!: string;

  @ApiProperty({ enum: WebhookEventType })
  eventType!: WebhookEventType;

  @ApiProperty({ enum: WebhookStatus })
  status!: WebhookStatus;

  @ApiProperty({ example: 2 })
  attemptCount!: number;

  @ApiProperty({ nullable: true, example: 'HTTP_ERROR' })
  failureReason!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  nextAttemptAt!: Date | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  lastAttemptAt!: Date | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  succeededAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class WebhookDeliveryDetailDto extends WebhookDeliveryListItemDto {
  @ApiProperty({ type: [WebhookAttemptSummaryDto] })
  attempts!: WebhookAttemptSummaryDto[];
}

export class WebhookDeliveryListResponseDto {
  @ApiProperty({ type: [WebhookDeliveryListItemDto] })
  data!: WebhookDeliveryListItemDto[];

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 125 })
  total!: number;
}
