import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntegrationProvider } from '../../common/enums/integration-provider.enum';
import { IntegrationStatus } from '../../common/enums/integration-status.enum';

export class IntegrationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  businessId: string;

  @ApiProperty({ enum: IntegrationProvider })
  provider: IntegrationProvider;

  @ApiProperty()
  isConnected: boolean;

  @ApiProperty()
  isEnabled: boolean;

  @ApiProperty()
  autoReplyEnabled: boolean;

  @ApiPropertyOptional({ enum: IntegrationStatus, nullable: true })
  status: IntegrationStatus | null;

  @ApiPropertyOptional({ nullable: true })
  externalAccountId: string | null;

  @ApiPropertyOptional({ nullable: true })
  wabaId: string | null;

  @ApiPropertyOptional({ nullable: true })
  phoneNumberId: string | null;

  @ApiPropertyOptional({ nullable: true })
  accessTokenEncrypted: string | null;

  @ApiProperty()
  webhookSubscribed: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  configJson: Record<string, unknown> | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
