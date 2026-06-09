import { IsString, IsOptional, IsIn, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ITEM_TYPES = ['AUDIO', 'WORD_DOC', 'PDF', 'BRAILLE', 'OTHER'] as const;

export class CreateLibraryItemDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsString() @IsOptional() author?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() subject?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() curriculum?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() country?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiProperty({ enum: ITEM_TYPES }) @IsIn(ITEM_TYPES) itemType: string;
  @ApiProperty() @IsString() fileUrl: string;
  @ApiProperty() @IsString() fileName: string;
  @ApiPropertyOptional() @IsInt() @IsOptional() fileSize?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() published?: boolean;
}
