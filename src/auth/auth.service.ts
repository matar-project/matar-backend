import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SIGNUP_ROLES, SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly roleNames = ['admin', ...SIGNUP_ROLES] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.prisma.role.createMany({
      data: this.roleNames.map((name) => ({ name })),
      skipDuplicates: true,
    });
  }

  async signup(signupDto: SignupDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: signupDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const role = await this.prisma.role.findUnique({
      where: { name: signupDto.role },
    });

    if (!role) {
      throw new Error('Application roles have not been initialized');
    }

    const passwordHash = await bcrypt.hash(signupDto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: signupDto.name.trim(),
        email: signupDto.email,
        passwordHash,
        roleId: role.id,
      },
      include: { role: true },
    });

    return this.createSession(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: { role: true },
    });

    if (
      !user ||
      !(await bcrypt.compare(loginDto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createSession(user);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: number; type: string };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
      include: { user: { include: { role: true } } },
    });

    if (
      !storedToken ||
      storedToken.userId !== payload.sub ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    return this.createSession(storedToken.user);
  }

  private async createSession(user: {
    id: number;
    name: string;
    email: string;
    role: { name: string };
  }) {
    const accessTtl = this.getNumberConfig('JWT_ACCESS_TTL_SECONDS', 15 * 60);
    const refreshTtl = this.getNumberConfig(
      'JWT_REFRESH_TTL_SECONDS',
      7 * 24 * 60 * 60,
    );
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, type: 'access' },
        {
          secret: this.getRequiredConfig('JWT_ACCESS_SECRET'),
          expiresIn: accessTtl,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh', jti: randomUUID() },
        {
          secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
          expiresIn: refreshTtl,
        },
      ),
    ]);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
      },
      accessToken,
      refreshToken,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRequiredConfig(name: string) {
    const value = this.configService.get<string>(name);

    if (!value) {
      throw new Error(`${name} is not configured`);
    }

    return value;
  }

  private getNumberConfig(name: string, defaultValue: number) {
    const value = Number(this.configService.get<string>(name) ?? defaultValue);
    return Number.isFinite(value) && value > 0 ? value : defaultValue;
  }
}
