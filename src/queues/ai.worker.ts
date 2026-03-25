import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { AiService } from '../ai/ai.service';
import { createRedisConnectionOptions, isRedisConfigured } from '../common/queue/redis-connection';
import { AI_JOB_NAMES, AiJobData, AiSuggestReplyJobData } from './ai.jobs';

@Injectable()
export class AiWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiWorker.name);
  private worker?: Worker;
  private enabled = false;

  constructor(
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.enabled = process.env.NODE_ENV !== 'test' && isRedisConfigured(this.configService);
    if (!this.enabled) {
      this.logger.log('AI worker disabled');
      return;
    }

    this.worker = new Worker<AiJobData>(
      'ai-jobs',
      async (job) => this.process(job),
      {
        connection: createRedisConnectionOptions(this.configService),
        concurrency: 3,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Completed AI job ${job.name} (${job.id ?? 'no-id'})`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.warn(`Failed AI job ${job?.name ?? 'unknown'} (${job?.id ?? 'no-id'}): ${error.message}`);
    });

    this.worker.on('error', (error) => {
      this.logger.error(`AI worker error: ${error.message}`, error.stack);
    });
  }

  async onModuleDestroy() {
    if (this.enabled) {
      await this.worker?.close();
    }
  }

  private async process(job: Job<AiJobData>) {
    switch (job.name) {
      case AI_JOB_NAMES.SUMMARIZE_LEAD:
        return this.aiService.summarizeLeadForBusiness(job.data.businessId, job.data.leadId);
      case AI_JOB_NAMES.SCORE_PRIORITY:
        return this.aiService.scorePriorityForBusiness(job.data.businessId, job.data.leadId);
      case AI_JOB_NAMES.SUGGEST_REPLY:
        return this.aiService.suggestReplyForBusiness(
          job.data.businessId,
          job.data.leadId,
          (job.data as AiSuggestReplyJobData).request,
        );
      default:
        throw new Error(`Unsupported AI job: ${job.name}`);
    }
  }
}
