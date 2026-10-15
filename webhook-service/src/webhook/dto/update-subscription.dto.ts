import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateSubscriptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @IsUrl()
  endpoint: string;

  @IsBoolean()
  isActive: boolean;
}
