import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsISO31661Alpha2,
  IsPhoneNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsStrongPassword } from './password-strength.validator';

export const SIGNUP_ROLES = ['volunteer', 'visually_impired'] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export class SignupDto {
  @ApiProperty({ example: 'Alaa', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'alaa@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/)
  email!: string;

  @ApiProperty({ example: '+962790000000' })
  @IsPhoneNumber()
  @MaxLength(16)
  phone!: string;

  @ApiProperty({ example: 'JO' })
  @IsISO31661Alpha2()
  country!: string;

  @ApiProperty({ example: 'Amman', minLength: 2, maxLength: 30 })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  city!: string;

  @ApiProperty({ example: 'StrongPassword123!', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @IsStrongPassword()
  password!: string;

  @ApiProperty({ enum: SIGNUP_ROLES, example: 'volunteer' })
  @IsIn(SIGNUP_ROLES)
  role!: SignupRole;

  // Multer handles the file itself; this keeps multipart field validation from
  // rejecting the healthReport key before @UploadedFile() receives it.
  @IsOptional()
  healthReport?: unknown;
}
