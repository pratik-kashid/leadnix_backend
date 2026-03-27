import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { EmailService, PasswordResetOtpEmailInput } from './email.service';

@Injectable()
export class SmtpEmailService extends EmailService {
  private readonly logger = new Logger(SmtpEmailService.name);
  private readonly transporters = new Map<string, Transporter>();

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async sendPasswordResetOtp(input: PasswordResetOtpEmailInput): Promise<void> {
    const transporters = this.getTransporters();
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

    for (let index = 0; index < transporters.length; index += 1) {
      const transporter = transporters[index];
      try {
        const result = await transporter.sendMail({
          from,
          to: input.email,
          subject,
          text,
          html,
        });

        this.logger.log(
          `Password reset OTP email queued for ${input.email} (${result.messageId ?? 'no message id'})`,
        );
        return;
      } catch (error) {
        const isLastAttempt = index === transporters.length - 1;
        try {
          this.logger.warn(
            `SMTP attempt ${index + 1}/${transporters.length} failed for ${input.email}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        } catch (_) {
          // no-op, logging must not block fallback attempts
        }

        if (isLastAttempt) {
          this.logger.error(
            `Failed to send OTP email to ${input.email}: ${
              error instanceof Error ? error.message : String(error)
            }`,
            error instanceof Error ? error.stack : undefined,
          );
          throw new ServiceUnavailableException('Unable to send OTP email at this time');
        }
      }
    }

    throw new ServiceUnavailableException('Unable to send OTP email at this time');
  }

  private getTransporters(): Transporter[] {
    const host = this.configService.get<string>('SMTP_HOST')?.trim();
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 0);
    const user = this.configService.get<string>('SMTP_USER')?.trim();
    const pass = this.configService.get<string>('SMTP_PASS')?.trim();

    if (!host || !port || !user || !pass) {
      throw new Error('SMTP configuration is incomplete');
    }

    const normalizedHost = host.toLowerCase();
    const isGmailHost = normalizedHost === 'smtp.gmail.com' || normalizedHost === 'smtp.googlemail.com';
    const cacheKey = `${normalizedHost}:${port}:${user}`;

    const primary = this.getOrCreateTransporter(cacheKey, host, port, user, pass);
    const transporters = [primary];

    if (isGmailHost) {
      const fallbackPort = port === 465 ? 587 : 465;
      const fallbackKey = `${normalizedHost}:${fallbackPort}:${user}`;
      transporters.push(this.getOrCreateTransporter(fallbackKey, host, fallbackPort, user, pass));
    }

    return transporters;
  }

  private getOrCreateTransporter(
    cacheKey: string,
    host: string,
    port: number,
    user: string,
    pass: string,
  ): Transporter {
    const existing = this.transporters.get(cacheKey);
    if (existing) {
      return existing;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });

    this.transporters.set(cacheKey, transporter);
    return transporter;
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
