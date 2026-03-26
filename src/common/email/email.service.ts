import { Injectable, Logger } from '@nestjs/common';

export abstract class EmailService {
  abstract sendPasswordResetOtp(input: {
    email: string;
    otp: string;
    name?: string | null;
  }): Promise<void>;
}

@Injectable()
export class ConsoleEmailService implements EmailService {
  private readonly logger = new Logger(ConsoleEmailService.name);

  async sendPasswordResetOtp(input: { email: string; otp: string; name?: string | null }): Promise<void> {
    this.logger.log(
      `Password reset OTP for ${input.email}: ${input.otp}${input.name ? ` (name: ${input.name})` : ''}`,
    );
  }
}
