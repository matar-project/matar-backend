import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token returned by login or signup' })
  @IsJWT()
  refreshToken!: string;
}
