import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateSubscriptionDto {
  @ApiProperty({
    example: 'https://consumer.example.com/webhooks/payments',
    maxLength: 2048,
    format: 'uri',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @IsUrl({ require_tld: false })
  endpoint: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive: boolean;
}
