import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({ enum: IntegrationStatus })
  status: IntegrationStatus;

  @ApiProperty({ type: 'object', additionalProperties: true })
  configJson: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
