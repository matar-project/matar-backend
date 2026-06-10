import {
  ConflictException,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(AuthService.name);
  private readonly roleNames = ['admin', ...SIGNUP_ROLES] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log(`Seeding roles: ${this.roleNames.join(', ')}`);
    await this.prisma.role.createMany({
      data: this.roleNames.map((name) => ({ name })),
      skipDuplicates: true,
    });
    this.logger.log('Roles seeded successfully');
  }

  async signup(signupDto: SignupDto) {
    this.logger.log(`Signup attempt for email=${signupDto.email} role=${signupDto.role}`);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: signupDto.email },
    });

    if (existingUser) {
      this.logger.warn(`Signup failed — email already registered: ${signupDto.email}`);
      throw new ConflictException('Email is already registered');
    }

    const role = await this.prisma.role.findUnique({
      where: { name: signupDto.role },
    });

    if (!role) {
      this.logger.error('Signup failed — application roles have not been initialized');
      throw new Error('Application roles have not been initialized');
    }

    const passwordHash = await bcrypt.hash(signupDto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: signupDto.name.trim(),
        email: signupDto.email,
        phone: signupDto.phone,
        country: signupDto.country,
        city: signupDto.city.trim(),
        passwordHash,
        roleId: role.id,
      },
      include: { role: true },
    });

    this.logger.log(`User created: id=${user.id} email=${user.email} role=${user.role.name}`);
    return this.createSession(user);
  }

  async login(loginDto: LoginDto) {
    this.logger.log(`Login attempt for email=${loginDto.email}`);

    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: { role: true },
    });

    if (
      !user ||
      !(await bcrypt.compare(loginDto.password, user.passwordHash))
    ) {
      this.logger.warn(`Login failed — invalid credentials for email=${loginDto.email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`Login successful: id=${user.id} email=${user.email} role=${user.role.name}`);
    return this.createSession(user);
  }

  async refresh(refreshToken: string) {
    this.logger.log('Token refresh attempt');
    let payload: { sub: number; type: string };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
      });
    } catch {
      this.logger.warn('Token refresh failed — invalid or expired JWT');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      this.logger.warn(`Token refresh failed — wrong token type="${payload.type}" for userId=${payload.sub}`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
      include: { user: { include: { role: true } } },
    });

    if (!storedToken || storedToken.userId !== payload.sub) {
      this.logger.warn(`Token refresh failed — token not found or userId mismatch for userId=${payload.sub}`);
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    if (storedToken.revokedAt) {
      this.logger.warn(`Token refresh failed — token already revoked for userId=${storedToken.userId}`);
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    if (storedToken.expiresAt <= new Date()) {
      this.logger.warn(`Token refresh failed — token expired for userId=${storedToken.userId}`);
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Token refreshed for userId=${storedToken.userId}`);
    return this.createSession(storedToken.user);
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return;

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  getRefreshTokenTtlMs() {
    return this.getNumberConfig(
      'JWT_REFRESH_TTL_SECONDS',
      7 * 24 * 60 * 60,
    ) * 1000;
  }

  private async createSession(user: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
    city: string | null;
    role: { name: string };
  }) {
    const accessTtl = this.getNumberConfig('JWT_ACCESS_TTL_SECONDS', 15 * 60);
    const refreshTtl = this.getNumberConfig(
      'JWT_REFRESH_TTL_SECONDS',
      7 * 24 * 60 * 60,
    );
    const payload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, type: 'access', jti: randomUUID() },
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
        phone: user.phone,
        country: user.country,
        city: user.city,
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
