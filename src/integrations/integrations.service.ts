import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(Integration)
    private readonly integrationsRepository: Repository<Integration>,
    private readonly businessesService: BusinessesService,
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
        isEnabled: false,
        autoReplyEnabled: false,
        status: IntegrationStatus.DISCONNECTED,
        configJson: {},
      }),
    );

    await repository.save(integrations);
  }
}
