import {
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

const REQUEST_TYPES = ['PDF_TO_WORD', 'PDF_TO_AUDIO', 'ACCOMPANIMENT'] as const;

export class CreateRequestDto {
  @ApiProperty({ enum: REQUEST_TYPES })
  @IsIn(REQUEST_TYPES)
  requestType!: (typeof REQUEST_TYPES)[number];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  details!: string;

  @ApiPropertyOptional({ minimum: 1 })
  @ValidateIf((dto: CreateRequestDto) => dto.requestType !== 'ACCOMPANIMENT')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalPages?: number;
}
