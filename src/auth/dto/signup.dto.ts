import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const SIGNUP_ROLES = ['vlounteer', 'visually_impired'] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export class SignupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsIn(SIGNUP_ROLES)
  role!: SignupRole;
}
