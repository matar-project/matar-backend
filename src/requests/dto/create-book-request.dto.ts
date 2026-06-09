import {
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookRequestDto {
  @ApiProperty() @IsString() @MinLength(1) bookTitle: string;
  @ApiPropertyOptional() @IsString() @IsOptional() author?: string;
  @ApiProperty() @IsString() @MinLength(1) subject: string;
  @ApiPropertyOptional() @IsString() @IsOptional() curriculum?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() academicYear?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
