import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    // Gmail SMTP can deliver to any recipient (no domain verification needed),
    // unlike Resend's shared test sender. Use an App Password for SMTP_PASS
    // (requires 2-Step Verification on the Google account).
    if (host && user && pass) {
      const port = Number(this.config.get<string>('SMTP_PORT') ?? '465');
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: this.config.get<string>('SMTP_SECURE') !== 'false' && port === 465,
        auth: { user, pass },
      });
    } else {
      this.transporter = null;
    }

    this.from = this.config.get<string>('SMTP_FROM') ?? `Matar <${user ?? ''}>`;
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

  async sendRejectionEmail(email: string, name: string, reason: string) {
    await this.send(
      email,
      'بخصوص مراجعة حسابك في مطر',
      `<div dir="rtl"><p>مرحباً ${this.escape(name)}،</p><p>تمت مراجعة تقريرك الصحي ولم نتمكن من قبول حسابك للسبب التالي:</p><p><strong>${this.escape(reason)}</strong></p><p>يمكنك رفع تقرير صحي جديد لإعادة المراجعة بتسجيل الدخول إلى حسابك.</p></div>`,
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

    const start = Date.now();
    try {
      const info = await this.transporter!.sendMail({
        from: this.from,
        to,
        subject,
        html,
      });
      this.logger.log(
        `Email to ${to} sent in ${Date.now() - start}ms (id: ${info.messageId})`,
      );
    } catch (error) {
      this.logger.error('SMTP email delivery failed', error);
      throw new ServiceUnavailableException(
        'تعذر إرسال البريد الإلكتروني. يرجى المحاولة لاحقاً.',
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
