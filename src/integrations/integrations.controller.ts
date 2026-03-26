import { Body, Controller, Get, Param, Patch, ParseEnumPipe, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { IntegrationProvider } from '../common/enums/integration-provider.enum';
import { MockWhatsappConnectDto } from './dto/mock-whatsapp-connect.dto';
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

  @Post('whatsapp/connect/mock')
  @ApiOperation({
    summary: 'Temporary development-only WhatsApp connect flow',
    description: 'Creates or updates the current business WhatsApp integration for local/dev testing only.',
  })
  @ApiOkResponse({ type: IntegrationResponseDto })
  connectMockWhatsapp(
    @CurrentUser() user: JwtPayload,
    @Body() dto: MockWhatsappConnectDto,
  ): Promise<IntegrationResponseDto> {
    return this.integrationsService
      .connectMockWhatsApp(user.sub, dto, user.businessId ?? undefined)
      .then((integration) => this.toResponse(integration));
  }

  @Get()
  @ApiOkResponse({ type: IntegrationResponseDto, isArray: true })
  list(
    @CurrentUser() user: JwtPayload,
  ): Promise<IntegrationResponseDto[]> {
    return this.listCurrentBusiness(user);
  }

  @Get('me')
  @ApiOkResponse({ type: IntegrationResponseDto, isArray: true })
  listMe(
    @CurrentUser() user: JwtPayload,
  ): Promise<IntegrationResponseDto[]> {
    return this.listCurrentBusiness(user);
  }

  @Patch(':id/enabled')
  @ApiOkResponse({ type: IntegrationResponseDto })
  updateEnabledById(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateIntegrationEnabledDto,
  ): Promise<IntegrationResponseDto> {
    return this.integrationsService
      .setEnabledById(user.sub, id, dto.enabled, user.businessId ?? undefined)
      .then((integration) => this.toResponse(integration));
  }

  @Patch(':id/auto-reply')
  @ApiOkResponse({ type: IntegrationResponseDto })
  updateAutoReplyById(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateIntegrationAutoReplyDto,
  ): Promise<IntegrationResponseDto> {
    return this.integrationsService
      .setAutoReplyEnabledById(user.sub, id, dto.autoReplyEnabled, user.businessId ?? undefined)
      .then((integration) => this.toResponse(integration));
  }

  @Post(':id/disconnect')
  @ApiOkResponse({ type: IntegrationResponseDto })
  disconnectById(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<IntegrationResponseDto> {
    return this.integrationsService
      .disconnectById(user.sub, id, user.businessId ?? undefined)
      .then((integration) => this.toResponse(integration));
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
    status: string | null;
    phoneNumberId: string | null;
    wabaId: string | null;
    displayLabel: string | null;
    configJson: Record<string, unknown> | null;
  }): IntegrationResponseDto {
    return {
      id: integration.id,
      businessId: integration.businessId,
      provider: integration.provider,
      isConnected: integration.isConnected,
      isEnabled: integration.isEnabled,
      autoReplyEnabled: integration.autoReplyEnabled,
      status: integration.status as IntegrationResponseDto['status'] | null,
      phoneNumberId: integration.phoneNumberId,
      wabaId: integration.wabaId,
      displayLabel: integration.displayLabel ?? (integration.isConnected ? this.resolveDisplayLabel(integration) : null),
    };
  }

  private listCurrentBusiness(user: JwtPayload): Promise<IntegrationResponseDto[]> {
    return this.integrationsService
      .listForCurrentBusiness(user.sub, user.businessId ?? undefined)
      .then((integrations) => integrations.map((integration) => this.toResponse(integration)));
  }

  private resolveDisplayLabel(integration: {
    provider: IntegrationProvider;
    phoneNumberId: string | null;
    wabaId: string | null;
    configJson: Record<string, unknown> | null;
  }): string | null {
    const configJson = integration.configJson ?? {};
    const candidates = [
      this.readString(configJson.displayLabel),
      this.readString(configJson.label),
      this.readString(configJson.accountLabel),
      this.readString(configJson.displayPhoneNumber),
      this.readString((configJson as Record<string, unknown>)['display_phone_number']),
      this.readString(configJson.phoneNumber),
    ].filter((value): value is string => Boolean(value));

    if (candidates.length > 0) {
      return candidates[0];
    }

    if (integration.provider === IntegrationProvider.WHATSAPP) {
      if (integration.phoneNumberId) {
        return `WhatsApp ${integration.phoneNumberId}`;
      }

      if (integration.wabaId) {
        return `WhatsApp ${integration.wabaId}`;
      }
    }

    return integration.provider.replaceAll('_', ' ');
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }
}
