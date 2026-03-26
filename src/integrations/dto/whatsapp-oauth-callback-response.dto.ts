import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WhatsAppOAuthCompletionPayloadDto {
  @ApiPropertyOptional({ nullable: true })
  wabaId: string | null;

  @ApiPropertyOptional({ nullable: true })
  phoneNumberId: string | null;

  @ApiPropertyOptional({ nullable: true })
  displayLabel: string | null;

  @ApiPropertyOptional({ nullable: true })
  businessAccountName: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  configJson: Record<string, unknown> | null;
}

export class WhatsAppOauthCallbackResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ example: 'WHATSAPP' })
  provider: 'WHATSAPP';

  @ApiProperty()
  completionReady: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional({ nullable: true })
  state: string | null;

  @ApiPropertyOptional({ nullable: true })
  error: string | null;

  @ApiPropertyOptional({ nullable: true })
  errorDescription: string | null;

  @ApiProperty()
  completionPayload: WhatsAppOAuthCompletionPayloadDto;
}
