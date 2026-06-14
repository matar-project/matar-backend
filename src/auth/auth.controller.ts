import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import {
  ResendEmailCodeDto,
  VerifyEmailCodeDto,
} from './dto/email-verification.dto';
import { verificationReportUploadOptions } from './verification-report-upload.config';
import { UploadedFileCleanupInterceptor } from '../requests/uploaded-file-cleanup.interceptor';

const REFRESH_COOKIE = 'matar_refresh_token';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('healthReport', verificationReportUploadOptions),
    UploadedFileCleanupInterceptor,
  )
  async signup(
    @Body() signupDto: SignupDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authService.signup(signupDto, file);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-email-code')
  async verifyEmail(
    @Body() dto: VerifyEmailCodeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.setSessionCookie(
      response,
      await this.authService.verifyEmailCode(dto),
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('resend-email-code')
  resendEmailCode(@Body() dto: ResendEmailCodeDto) {
    return this.authService.resendEmailCode(dto.signupToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.setSessionCookie(response, await this.authService.login(loginDto));
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Request() request: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token cookie is missing');
    }

    return this.setSessionCookie(
      response,
      await this.authService.refresh(refreshToken),
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Request() request: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(request.cookies?.[REFRESH_COOKIE]);
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() req: any) {
    const { sub: id, email, role, name, status } = req.user;
    return { id, name, email, role, status };
  }

  private setSessionCookie(
    response: Response,
    session: Awaited<ReturnType<AuthService['login']>>,
  ) {
    response.cookie(
      REFRESH_COOKIE,
      session.refreshToken,
      this.cookieOptions(this.authService.getRefreshTokenTtlMs()),
    );

    const { refreshToken: _refreshToken, ...publicSession } = session;
    return publicSession;
  }

  private cookieOptions(maxAge?: number): CookieOptions {
    const production = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: production,
      sameSite: production ? 'none' : 'lax',
      path: '/api/auth',
      ...(maxAge ? { maxAge } : {}),
    };
  }
}
