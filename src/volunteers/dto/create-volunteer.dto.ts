import { IsString, IsEmail, IsOptional, IsArray, IsIn, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const INTERESTS = ['AUDIO_RECORDING', 'WORD_CONVERSION', 'BOOK_TYPING', 'ACCOMPANIMENT', 'GENERAL'] as const;
const CONTACTS = ['WHATSAPP', 'FACEBOOK', 'MESSENGER'] as const;

export class CreateVolunteerDto {
  @ApiProperty() @IsString() @MinLength(2) name: string;
  @ApiProperty() @IsString() @Matches(/^[+\d\s-]{7,20}$/) phone: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiProperty() @IsString() @MinLength(2) city: string;
  @ApiProperty({ enum: INTERESTS, isArray: true })
  @IsArray() @IsIn(INTERESTS, { each: true }) interests: string[];
  @ApiProperty({ enum: CONTACTS })
  @IsIn(CONTACTS) preferredContact: string;
}
