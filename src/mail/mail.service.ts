import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'dns';
import nodemailer, { type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    this.transporter =
      host && user && pass
        ? nodemailer.createTransport({
            host,
            port: Number(this.config.get('SMTP_PORT') ?? 587),
            secure: this.config.get('SMTP_SECURE') === 'true',
            lookup: (hostname, _options, callback) =>
              lookup(hostname, { family: 4 }, callback),
            auth: { user, pass },
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 15_000,
          } as SMTPTransport.Options & {
            lookup: typeof lookup;
          })
        : null;
  }

  async sendVerificationCode(email: string, name: string, code: string) {
    await this.send(
      email,
      'رمز تأكيد البريد الإلكتروني - مطر',
      `<div dir="rtl"><p>مرحباً ${this.escape(name)}،</p><p>رمز تأكيد بريدك الإلكتروني هو:</p><h2>${code}</h2><p>ينتهي الرمز خلال 10 دقائق.</p></div>`,
    );
  }

  async sendApprovalEmail(email: string, name: string) {
    await this.send(
      email,
      'تم قبول حسابك في مطر',
      `<div dir="rtl"><p>مرحباً ${this.escape(name)}،</p><p>تمت مراجعة تقريرك الصحي وقبول حسابك. يمكنك الآن تسجيل الدخول والاستفادة من خدمات مطر.</p></div>`,
    );
  }

  ensureConfigured() {
    if (!this.transporter) {
      throw new ServiceUnavailableException(
        'خدمة البريد الإلكتروني غير مهيأة. يرجى التواصل مع الإدارة.',
      );
    }
  }

  private async send(to: string, subject: string, html: string) {
    this.ensureConfigured();

    try {
      await this.transporter!.sendMail({
        from:
          this.config.get<string>('SMTP_FROM') ??
          this.config.get<string>('SMTP_USER'),
        to,
        subject,
        html,
      });
    } catch (error) {
      this.logger.error('SMTP email delivery failed', error);
      throw new ServiceUnavailableException(
        'تعذر إرسال البريد الإلكتروني. تحقق من إعدادات Gmail وكلمة مرور التطبيق.',
      );
    }
  }

  private escape(value: string) {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return entities[character];
    });
  }
}
