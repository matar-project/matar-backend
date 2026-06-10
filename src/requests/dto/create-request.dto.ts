import {
  IsIn,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const REQUEST_TYPES = ['BOOK_CONVERSION', 'AUDIO_RECORDING', 'EDUCATIONAL_SUPPORT', 'ACCOMPANIMENT', 'OTHER'] as const;

export class CreateRequestDto {
  @ApiProperty({ enum: REQUEST_TYPES }) @IsIn(REQUEST_TYPES) requestType: string;
  @ApiProperty() @IsString() @MinLength(10) details: string;
}
