import { Transform } from 'class-transformer';
import { IsEmail, IsString, IsUUID, Matches } from 'class-validator';

export class EmailDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;
}

export class VerifyEmailCodeDto extends EmailDto {
  @IsUUID()
  signupToken!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ResendEmailCodeDto {
  @IsUUID()
  signupToken!: string;
}
