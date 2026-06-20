import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    // Falls back to Resend's shared test sender, which only delivers to the
    // account owner's address. Set RESEND_FROM to a verified-domain address
    // (e.g. "Matar <noreply@yourdomain.com>") to send to real recipients.
    this.from =
      this.config.get<string>('RESEND_FROM') ?? 'Matar <onboarding@resend.dev>';
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
    if (!this.resend) {
      throw new ServiceUnavailableException(
        'خدمة البريد الإلكتروني غير مهيأة. يرجى التواصل مع الإدارة.',
      );
    }
  }

  private async send(to: string, subject: string, html: string) {
    this.ensureConfigured();

    const start = Date.now();
    const { data, error } = await this.resend!.emails.send({
      from: this.from,
      to,
      subject,
      html,
    });

    if (error) {
      this.logger.error('Resend email delivery failed', error);
      throw new ServiceUnavailableException(
        'تعذر إرسال البريد الإلكتروني. يرجى المحاولة لاحقاً.',
      );
    }

    this.logger.log(
      `Email to ${to} accepted by Resend in ${Date.now() - start}ms (id: ${data?.id})`,
    );
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
