import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class AcceptRequestDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RejectRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  reason!: string;
}
