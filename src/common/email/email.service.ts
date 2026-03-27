export type PasswordResetOtpEmailInput = {
  email: string;
  otp: string;
  name?: string | null;
  expiresInMinutes?: number;
};

export abstract class EmailService {
  abstract sendPasswordResetOtp(input: PasswordResetOtpEmailInput): Promise<void>;
}
