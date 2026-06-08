import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const SIGNUP_ROLES = ['vlounteer', 'visually_impired'] as const;
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
  email!: string;

  @ApiProperty({ example: 'StrongPassword123!', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ enum: SIGNUP_ROLES, example: 'vlounteer' })
  @IsIn(SIGNUP_ROLES)
  role!: SignupRole;
}
