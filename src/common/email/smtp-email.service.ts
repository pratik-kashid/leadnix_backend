import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { EmailService, PasswordResetOtpEmailInput } from './email.service';

@Injectable()
export class SmtpEmailService extends EmailService {
  private readonly logger = new Logger(SmtpEmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async sendPasswordResetOtp(input: PasswordResetOtpEmailInput): Promise<void> {
    const transporter = this.getTransporter();
    const from = this.configService.get<string>('MAIL_FROM')?.trim();

    if (!from) {
      throw new Error('MAIL_FROM is not configured');
    }

    const otp = input.otp.trim();
    const recipientName = input.name?.trim();
    const expiresInMinutes = input.expiresInMinutes ?? 10;
    const subject = 'Leadnix password reset code';
    const salutation = recipientName ? `Hi ${recipientName},` : 'Hi,';
    const text = [
      salutation,
      '',
      `Your Leadnix password reset code is ${otp}.`,
      `This code expires in ${expiresInMinutes} minutes.`,
      '',
      'If you did not request this email, you can safely ignore it.',
      '',
      'Thanks,',
      'Leadnix Team',
    ].join('\n');
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>${this.escapeHtml(salutation)}</p>
        <p>Your Leadnix password reset code is <strong style="font-size: 20px; letter-spacing: 3px;">${this.escapeHtml(otp)}</strong>.</p>
        <p>This code expires in ${expiresInMinutes} minutes.</p>
        <p>If you did not request this email, you can safely ignore it.</p>
        <p>Thanks,<br/>Leadnix Team</p>
      </div>
    `;

    try {
      const result = await transporter.sendMail({
        from,
        to: input.email,
        subject,
        text,
        html,
      });

      this.logger.log(`Password reset OTP email queued for ${input.email} (${result.messageId ?? 'no message id'})`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${input.email}`, error instanceof Error ? error.stack : undefined);
      throw new Error('Unable to send OTP email at this time');
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.configService.get<string>('SMTP_HOST')?.trim();
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 0);
    const user = this.configService.get<string>('SMTP_USER')?.trim();
    const pass = this.configService.get<string>('SMTP_PASS')?.trim();

    if (!host || !port || !user || !pass) {
      throw new Error('SMTP configuration is incomplete');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
