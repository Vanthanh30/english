import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');

    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: config.get<number>('SMTP_PORT', 587),
          secure: config.get<boolean>('SMTP_SECURE', false),
          auth: user && password ? { user, pass: password } : undefined,
        })
      : null;
  }

  async sendVerificationEmail(
    recipient: string,
    displayName: string,
    token: string,
  ): Promise<void> {
    const webOrigin = this.config.get<string>(
      'WEB_ORIGIN',
      'http://localhost:3000',
    );
    const verificationUrl = `${webOrigin}/verify-email?token=${encodeURIComponent(token)}`;
    const safeDisplayName = this.escapeHtml(displayName);

    if (!this.transporter) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new Error('SMTP_HOST is required in production');
      }

      this.logger.log(
        `Email verification for ${recipient}: ${verificationUrl}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.config.get<string>(
        'EMAIL_FROM',
        'English Quest <no-reply@englishquest.local>',
      ),
      to: recipient,
      subject: 'Verify your English Quest account',
      text: `Hello ${displayName}, verify your account: ${verificationUrl}`,
      html: `<p>Hello ${safeDisplayName},</p><p>Verify your English Quest account:</p><p><a href="${verificationUrl}">Verify email</a></p>`,
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
