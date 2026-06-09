import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const STATUSES = ['NEW', 'IN_PROGRESS', 'COMPLETED'] as const;

export class UpdateRequestDto {
  @ApiPropertyOptional({ enum: STATUSES }) @IsIn(STATUSES) @IsOptional() status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
