import { ApiProperty } from '@nestjs/swagger';

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
