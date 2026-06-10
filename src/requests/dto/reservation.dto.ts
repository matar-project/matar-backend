import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  startPage!: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  endPage!: number;
}

export class RejectReservationDto {
  @ApiPropertyOptional()
  @IsString()
  @MinLength(1)
  @IsOptional()
  reason?: string;
}
