import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createDecipheriv, createHash } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { BusinessesService } from '../businesses/businesses.service';
import { IntegrationProvider } from '../common/enums/integration-provider.enum';
import { IntegrationStatus } from '../common/enums/integration-status.enum';
import { Integration } from './entities/integration.entity';

const SUPPORTED_PROVIDERS = [
  IntegrationProvider.WHATSAPP,
  IntegrationProvider.INSTAGRAM,
  IntegrationProvider.FACEBOOK,
  IntegrationProvider.WEBSITE_FORM,
] as const;

type WhatsAppSendResponse = {
  messaging_product?: string;
  contacts?: Array<{ input?: string; wa_id?: string }>;
  messages?: Array<{ id?: string }>;
};

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationsRepository: Repository<Integration>,
    private readonly businessesService: BusinessesService,
    private readonly configService: ConfigService,
  ) {}

  private getRepository(manager?: EntityManager): Repository<Integration> {
    return manager ? manager.getRepository(Integration) : this.integrationsRepository;
  }

  async listForCurrentBusiness(
    userId: string,
    businessId?: string,
    manager?: EntityManager,
  ): Promise<Integration[]> {
    const business = await this.businessesService.getMyBusiness(userId, businessId, manager);
    await this.ensureDefaultIntegrations(business.id, manager);

    return this.getRepository(manager).find({
      where: { businessId: business.id },
      order: { provider: 'ASC' },
    });
  }

  async setEnabled(
    userId: string,
    provider: IntegrationProvider,
    enabled: boolean,
    businessId?: string,
    manager?: EntityManager,
  ): Promise<Integration> {
    const integration = await this.getIntegrationForBusiness(userId, provider, businessId, manager);
    integration.isEnabled = enabled;

    if (!enabled) {
      integration.autoReplyEnabled = false;
      integration.status = IntegrationStatus.DISABLED;
    } else if (integration.isConnected) {
      integration.status = IntegrationStatus.CONNECTED;
    } else {
      integration.status = IntegrationStatus.DISCONNECTED;
    }

    return this.getRepository(manager).save(integration);
  }

  async setEnabledById(
    userId: string,
    integrationId: string,
    enabled: boolean,
    businessId?: string,
    manager?: EntityManager,
  ): Promise<Integration> {
    const integration = await this.getIntegrationByIdForUser(userId, integrationId, businessId, manager);
    integration.isEnabled = enabled;

    if (!enabled) {
      integration.autoReplyEnabled = false;
      integration.status = IntegrationStatus.DISABLED;
    } else if (integration.isConnected) {
      integration.status = IntegrationStatus.CONNECTED;
    } else {
      integration.status = IntegrationStatus.DISCONNECTED;
    }

    return this.getRepository(manager).save(integration);
  }

  async setAutoReplyEnabled(
    userId: string,
    provider: IntegrationProvider,
    autoReplyEnabled: boolean,
    businessId?: string,
    manager?: EntityManager,
  ): Promise<Integration> {
    const integration = await this.getIntegrationForBusiness(userId, provider, businessId, manager);
    integration.autoReplyEnabled = autoReplyEnabled;
    return this.getRepository(manager).save(integration);
  }

  async setAutoReplyEnabledById(
    userId: string,
    integrationId: string,
    autoReplyEnabled: boolean,
    businessId?: string,
    manager?: EntityManager,
  ): Promise<Integration> {
    const integration = await this.getIntegrationByIdForUser(userId, integrationId, businessId, manager);
    integration.autoReplyEnabled = autoReplyEnabled;
    return this.getRepository(manager).save(integration);
  }

  async disconnectById(
    userId: string,
    integrationId: string,
    businessId?: string,
    manager?: EntityManager,
  ): Promise<Integration> {
    const integration = await this.getIntegrationByIdForUser(userId, integrationId, businessId, manager);
    return this.disconnectIntegration(integration, manager);
  }

  async disconnect(
    userId: string,
    provider: IntegrationProvider,
    businessId?: string,
    manager?: EntityManager,
  ): Promise<Integration> {
    const integration = await this.getIntegrationForBusiness(userId, provider, businessId, manager);
    return this.disconnectIntegration(integration, manager);
  }

  async findActiveIntegrationForBusiness(
    businessId: string,
    provider: IntegrationProvider,
    manager?: EntityManager,
  ): Promise<Integration | null> {
    const repository = this.getRepository(manager);
    return repository.findOne({
      where: {
        businessId,
        provider,
        isConnected: true,
        isEnabled: true,
      },
    });
  }

  async sendWhatsAppTextMessage(
    integration: Pick<Integration, 'provider' | 'businessId' | 'phoneNumberId' | 'accessTokenEncrypted'>,
    toPhone: string,
    text: string,
  ): Promise<{ externalMessageId: string | null; rawResponse: unknown }> {
    if (integration.provider !== IntegrationProvider.WHATSAPP) {
      throw new BadRequestException('WhatsApp messages can only be sent through a WhatsApp integration');
    }

    if (!integration.phoneNumberId) {
      throw new BadRequestException('WhatsApp integration is missing phoneNumberId');
    }

    const recipient = this.normalizePhoneNumber(toPhone);
    if (!recipient) {
      throw new BadRequestException('A valid recipient phone number is required');
    }

    const messageText = text?.trim();
    if (!messageText) {
      throw new BadRequestException('Message text is required');
    }

    const accessToken = this.resolveWhatsAppAccessToken(integration.accessTokenEncrypted);
    const version = this.configService.get<string>('WHATSAPP_GRAPH_API_VERSION') ?? 'v21.0';
    const url = `https://graph.facebook.com/${version}/${integration.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: { body: messageText },
    };

    let response: Response;
    let rawResponse: WhatsAppSendResponse | Record<string, unknown> | null = null;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      rawResponse = (await response.json().catch(() => null)) as WhatsAppSendResponse | Record<string, unknown> | null;
    } catch (error) {
      this.logger.error(
        `WhatsApp send request failed for business ${integration.businessId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadGatewayException('Failed to send WhatsApp message');
    }

    if (!response.ok) {
      this.logger.warn(
        `WhatsApp send rejected for business ${integration.businessId} with status ${response.status}: ${JSON.stringify(rawResponse)}`,
      );
      throw new BadGatewayException('WhatsApp message could not be sent');
    }

    return {
      externalMessageId: this.extractMessageId(rawResponse),
      rawResponse,
    };
  }

  async normalizeConnectionState(
    userId: string,
    provider: IntegrationProvider,
    isConnected: boolean,
    businessId?: string,
    manager?: EntityManager,
  ): Promise<Integration> {
    const integration = await this.getIntegrationForBusiness(userId, provider, businessId, manager);
    integration.isConnected = isConnected;

    if (integration.isEnabled) {
      integration.status = isConnected ? IntegrationStatus.CONNECTED : IntegrationStatus.DISCONNECTED;
    }

    return this.getRepository(manager).save(integration);
  }

  private async disconnectIntegration(integration: Integration, manager?: EntityManager): Promise<Integration> {
    integration.isConnected = false;
    integration.isEnabled = false;
    integration.autoReplyEnabled = false;
    integration.status = IntegrationStatus.DISCONNECTED;
    integration.externalAccountId = null;
    integration.wabaId = null;
    integration.phoneNumberId = null;
    integration.accessTokenEncrypted = null;
    integration.webhookSubscribed = false;

    return this.getRepository(manager).save(integration);
  }

  private async getIntegrationForBusiness(
    userId: string,
    provider: IntegrationProvider,
    businessId?: string,
    manager?: EntityManager,
  ): Promise<Integration> {
    const business = await this.businessesService.getMyBusiness(userId, businessId, manager);
    const repository = this.getRepository(manager);

    await this.ensureDefaultIntegrations(business.id, manager);

    const integration = await repository.findOne({
      where: {
        businessId: business.id,
        provider,
      },
    });

    if (!integration) {
      throw new BadRequestException(`Unsupported integration provider: ${provider}`);
    }

    return integration;
  }

  private async getIntegrationByIdForUser(
    userId: string,
    integrationId: string,
    businessId?: string,
    manager?: EntityManager,
  ): Promise<Integration> {
    const repository = this.getRepository(manager);
    const integration = await repository.findOne({ where: { id: integrationId } });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    const accessibleBusinessIds = await this.businessesService.getAccessibleBusinessIds(userId, manager);
    if (!accessibleBusinessIds.includes(integration.businessId)) {
      throw new ForbiddenException('You do not have access to this integration');
    }

    if (businessId && integration.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this integration');
    }

    return integration;
  }

  private async ensureDefaultIntegrations(businessId: string, manager?: EntityManager): Promise<void> {
    const repository = this.getRepository(manager);
    const existing = await repository.find({
      where: { businessId },
      select: ['provider'],
    });
    const existingProviders = new Set(existing.map((integration) => integration.provider));
    const missingProviders = SUPPORTED_PROVIDERS.filter((provider) => !existingProviders.has(provider));

    if (missingProviders.length === 0) {
      return;
    }

    const integrations = missingProviders.map((provider) =>
      repository.create({
        businessId,
        provider,
        isConnected: false,
        isEnabled: true,
        autoReplyEnabled: false,
        status: IntegrationStatus.DISCONNECTED,
        externalAccountId: null,
        wabaId: null,
        phoneNumberId: null,
        accessTokenEncrypted: null,
        webhookSubscribed: false,
        configJson: null,
      }),
    );

    await repository.save(integrations);
  }

  private resolveWhatsAppAccessToken(storedToken: string | null): string {
    if (!storedToken) {
      throw new BadRequestException('WhatsApp integration is missing access token');
    }

    if (!storedToken.startsWith('enc:')) {
      return storedToken;
    }

    const secret = this.configService.get<string>('INTEGRATION_ENCRYPTION_KEY') ?? this.configService.get<string>('WHATSAPP_TOKEN_ENCRYPTION_KEY');
    if (!secret) {
      throw new BadRequestException('WhatsApp token is encrypted but no decryption key is configured');
    }

    return this.decryptToken(storedToken, secret);
  }

  private decryptToken(encryptedValue: string, secret: string): string {
    const payload = encryptedValue.slice(4);
    const [ivHex, tagHex, cipherText] = payload.split('.');

    if (!ivHex || !tagHex || !cipherText) {
      throw new BadRequestException('Invalid encrypted WhatsApp token format');
    }

    const key = createHash('sha256').update(secret).digest();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    return Buffer.concat([decipher.update(cipherText, 'base64'), decipher.final()]).toString('utf8');
  }

  private extractMessageId(rawResponse: unknown): string | null {
    if (!rawResponse || typeof rawResponse !== 'object') {
      return null;
    }

    const record = rawResponse as WhatsAppSendResponse;
    const messageId = record.messages?.[0]?.id;
    return typeof messageId === 'string' ? messageId : null;
  }

  private normalizePhoneNumber(phone: string): string {
    return phone.replace(/[^\d+]/g, '');
  }
}
