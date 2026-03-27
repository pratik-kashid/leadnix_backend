import { ApiProperty } from '@nestjs/swagger';

export class VerifyResetOtpResponseDto {
  @ApiProperty({ example: true })
  valid: boolean;

  @ApiProperty({ example: 'OTP verified' })
  message: string;
}
