import {
  IsArray,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const INTERESTS = ['AUDIO_RECORDING', 'WORD_CONVERSION', 'BOOK_TYPING', 'ACCOMPANIMENT', 'GENERAL'] as const;

export class CreateVolunteerDto {
  @ApiProperty({ enum: INTERESTS, isArray: true })
  @IsArray() @IsIn(INTERESTS, { each: true }) interests: string[];
}
