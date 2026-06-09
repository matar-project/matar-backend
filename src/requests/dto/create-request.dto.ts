import { IsString, IsEmail, IsOptional, IsIn, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const REQUEST_TYPES = ['BOOK_CONVERSION', 'AUDIO_RECORDING', 'EDUCATIONAL_SUPPORT', 'ACCOMPANIMENT', 'OTHER'] as const;

export class CreateRequestDto {
  @ApiProperty() @IsString() @MinLength(2) fullName: string;
  @ApiProperty() @IsString() @Matches(/^[+\d\s-]{7,20}$/) phone: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiProperty() @IsString() @MinLength(2) city: string;
  @ApiProperty({ enum: REQUEST_TYPES }) @IsIn(REQUEST_TYPES) requestType: string;
  @ApiProperty() @IsString() @MinLength(10) details: string;
}
