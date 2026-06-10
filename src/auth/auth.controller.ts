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
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

const REFRESH_COOKIE = 'matar_refresh_token';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(
    @Body() signupDto: SignupDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.setSessionCookie(response, await this.authService.signup(signupDto));
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
    const { sub: id, email, role, name } = req.user;
    return { id, name, email, role };
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
