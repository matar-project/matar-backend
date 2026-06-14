import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt, randomUUID } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import {
  AccountStatus,
  VerificationDocumentStatus,
} from '../generated/prisma/enums';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { VerifyEmailCodeDto } from './dto/email-verification.dto';
import { LoginDto } from './dto/login.dto';
import { SIGNUP_ROLES, SignupDto } from './dto/signup.dto';
import { PendingSignupService } from './pending-signup.service';
import { validateVerificationReport } from './verification-report-upload.config';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly roleNames = [
    'admin',
    'coordinator',
    ...SIGNUP_ROLES,
  ] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly pendingSignups: PendingSignupService,
  ) {}

  async onModuleInit() {
    await this.prisma.role.createMany({
      data: this.roleNames.map((name) => ({ name })),
      skipDuplicates: true,
    });
  }

  async signup(signupDto: SignupDto, file?: Express.Multer.File) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: signupDto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }
    if (signupDto.role === 'visually_impired' && !file) {
      throw new BadRequestException(
        'التقرير الصحي مطلوب لحساب المستفيد',
      );
    }
    if (signupDto.role === 'volunteer' && file?.path) {
      if (existsSync(file.path)) unlinkSync(file.path);
      file = undefined;
    }
    if (file) await validateVerificationReport(file);

    this.mailService.ensureConfigured();

    const now = new Date();
    const code = this.generateVerificationCode();
    const pending = this.pendingSignups.create({
      name: signupDto.name.trim(),
      email: signupDto.email,
      phone: signupDto.phone,
      country: signupDto.country,
      city: signupDto.city.trim(),
      passwordHash: await bcrypt.hash(signupDto.password, 12),
      role: signupDto.role,
      codeHash: await bcrypt.hash(code, 10),
      codeExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      attempts: 0,
      codeSentAt: now,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
      file: file
        ? {
            path: file.path,
            filename: file.filename,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          }
        : undefined,
    });

    void this.mailService
      .sendVerificationCode(pending.email, pending.name, code)
      .catch((error: unknown) => {
        this.logger.error(
          `Verification email delivery failed for ${pending.email}`,
          error instanceof Error ? error.stack : String(error),
        );
      });

    return {
      email: pending.email,
      signupToken: pending.token,
      accountType: pending.role,
      status: AccountStatus.EMAIL_VERIFICATION_PENDING,
      message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
    };
  }

  async verifyEmailCode(dto: VerifyEmailCodeDto) {
    const pending = this.pendingSignups.get(dto.signupToken);
    if (!pending || pending.email !== dto.email) {
      throw new BadRequestException('رمز التحقق غير صالح');
    }
    if (pending.codeExpiresAt <= new Date()) {
      throw new BadRequestException('انتهت صلاحية رمز التحقق');
    }
    if (pending.attempts >= 5) {
      throw new BadRequestException(
        'تم تجاوز عدد المحاولات. أعد إرسال الرمز',
      );
    }
    if (!(await bcrypt.compare(dto.code, pending.codeHash))) {
      pending.attempts += 1;
      throw new BadRequestException('رمز التحقق غير صحيح');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: pending.email },
    });
    if (existingUser) {
      this.pendingSignups.remove(dto.signupToken);
      throw new ConflictException('Email is already registered');
    }

    const role = await this.prisma.role.findUnique({
      where: { name: pending.role },
    });
    if (!role) throw new Error('Application roles have not been initialized');

    const status =
      pending.role === 'visually_impired'
        ? AccountStatus.PENDING_ADMIN_REVIEW
        : AccountStatus.ACTIVE;

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: pending.name,
          email: pending.email,
          phone: pending.phone,
          country: pending.country,
          city: pending.city,
          passwordHash: pending.passwordHash,
          roleId: role.id,
          emailVerified: true,
          status,
        },
        include: { role: true },
      });

      if (pending.role === 'visually_impired' && pending.file) {
        await tx.verificationDocument.create({
          data: {
            userId: created.id,
            filePath: pending.file.path,
            fileKey: pending.file.filename,
            originalName: pending.file.originalname,
            fileType: pending.file.mimetype,
            fileSize: pending.file.size,
            status: VerificationDocumentStatus.PENDING,
          },
        });
      }
      return created;
    });

    this.pendingSignups.remove(dto.signupToken, true);
    return this.createSession(user);
  }

  async resendEmailCode(signupToken: string) {
    const safeMessage =
      'إذا كان طلب التسجيل موجوداً، سيتم إرسال رمز تحقق جديد.';
    const pending = this.pendingSignups.get(signupToken);
    if (!pending) return { message: safeMessage };
    if (Date.now() - pending.codeSentAt.getTime() < 60_000) {
      return { message: safeMessage };
    }

    const code = this.generateVerificationCode();
    pending.codeHash = await bcrypt.hash(code, 10);
    pending.codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    pending.attempts = 0;
    pending.codeSentAt = new Date();
    await this.mailService.sendVerificationCode(
      pending.email,
      pending.name,
      code,
    );
    return { message: safeMessage };
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
    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'يرجى تأكيد البريد الإلكتروني أولاً',
      );
    }
    if (user.status === AccountStatus.SUSPENDED) {
      throw new UnauthorizedException('الحساب موقوف');
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
    return (
      this.getNumberConfig(
        'JWT_REFRESH_TTL_SECONDS',
        7 * 24 * 60 * 60,
      ) * 1000
    );
  }

  private async createSession(user: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
    city: string | null;
    status: AccountStatus;
    emailVerified: boolean;
    role: { name: string };
  }) {
    const accessTtl = this.getNumberConfig(
      'JWT_ACCESS_TTL_SECONDS',
      15 * 60,
    );
    const refreshTtl = this.getNumberConfig(
      'JWT_REFRESH_TTL_SECONDS',
      7 * 24 * 60 * 60,
    );
    const payload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      status: user.status,
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
        status: user.status,
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken,
    };
  }

  private generateVerificationCode() {
    return String(randomInt(100000, 1000000));
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRequiredConfig(name: string) {
    const value = this.configService.get<string>(name);
    if (!value) throw new Error(`${name} is not configured`);
    return value;
  }

  private getNumberConfig(name: string, defaultValue: number) {
    const value = Number(
      this.configService.get<string>(name) ?? defaultValue,
    );
    return Number.isFinite(value) && value > 0 ? value : defaultValue;
  }
}
