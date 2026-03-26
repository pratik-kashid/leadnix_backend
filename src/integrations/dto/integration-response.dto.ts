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
  phoneNumberId: string | null;

  @ApiPropertyOptional({ nullable: true })
  wabaId: string | null;

  @ApiPropertyOptional({ nullable: true })
  displayLabel: string | null;

  @ApiPropertyOptional({ nullable: true })
  maskedPhoneNumber: string | null;

  @ApiProperty()
  hasAccessToken: boolean;
}
