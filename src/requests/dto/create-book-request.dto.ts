import { IsString, IsEmail, IsOptional, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookRequestDto {
  @ApiProperty() @IsString() @MinLength(2) fullName: string;
  @ApiProperty() @IsString() @Matches(/^[+\d\s-]{7,20}$/) phone: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiProperty() @IsString() @MinLength(2) city: string;
  @ApiProperty() @IsString() @MinLength(1) bookTitle: string;
  @ApiPropertyOptional() @IsString() @IsOptional() author?: string;
  @ApiProperty() @IsString() @MinLength(1) subject: string;
  @ApiPropertyOptional() @IsString() @IsOptional() country?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() curriculum?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() academicYear?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
