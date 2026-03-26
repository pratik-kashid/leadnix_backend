import { Body, Controller, Get, Param, Patch, ParseEnumPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { IntegrationProvider } from '../common/enums/integration-provider.enum';
import { UpdateIntegrationAutoReplyDto } from './dto/update-integration-auto-reply.dto';
import { UpdateIntegrationEnabledDto } from './dto/update-integration-enabled.dto';
import { IntegrationResponseDto } from './dto/integration-response.dto';
import { IntegrationsService } from './integrations.service';

@ApiTags('integrations')
@Controller('integrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('me')
  @ApiOkResponse({ type: IntegrationResponseDto, isArray: true })
  listMe(@CurrentUser() user: JwtPayload): Promise<IntegrationResponseDto[]> {
    return this.integrationsService
      .listForCurrentBusiness(user.sub, user.businessId ?? undefined)
      .then((integrations) => integrations.map((integration) => this.toResponse(integration)));
  }

  @Patch(':provider/enabled')
  @ApiOkResponse({ type: IntegrationResponseDto })
  updateEnabled(
    @CurrentUser() user: JwtPayload,
    @Param('provider', new ParseEnumPipe(IntegrationProvider)) provider: IntegrationProvider,
    @Body() dto: UpdateIntegrationEnabledDto,
  ): Promise<IntegrationResponseDto> {
    return this.integrationsService
      .setEnabled(user.sub, provider, dto.enabled, user.businessId ?? undefined)
      .then((integration) => this.toResponse(integration));
  }

  @Patch(':provider/auto-reply')
  @ApiOkResponse({ type: IntegrationResponseDto })
  updateAutoReply(
    @CurrentUser() user: JwtPayload,
    @Param('provider', new ParseEnumPipe(IntegrationProvider)) provider: IntegrationProvider,
    @Body() dto: UpdateIntegrationAutoReplyDto,
  ): Promise<IntegrationResponseDto> {
    return this.integrationsService
      .setAutoReplyEnabled(user.sub, provider, dto.autoReplyEnabled, user.businessId ?? undefined)
      .then((integration) => this.toResponse(integration));
  }

  private toResponse(integration: {
    id: string;
    businessId: string;
    provider: IntegrationProvider;
    isConnected: boolean;
    isEnabled: boolean;
    autoReplyEnabled: boolean;
    status: string;
    configJson: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  }): IntegrationResponseDto {
    return {
      id: integration.id,
      businessId: integration.businessId,
      provider: integration.provider,
      isConnected: integration.isConnected,
      isEnabled: integration.isEnabled,
      autoReplyEnabled: integration.autoReplyEnabled,
      status: integration.status as IntegrationResponseDto['status'],
      configJson: integration.configJson ?? {},
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  }
}
