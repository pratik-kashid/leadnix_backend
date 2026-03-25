import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { createRedisConnectionOptions, isRedisConfigured } from '../common/queue/redis-connection';
import { AI_JOB_NAMES, AI_JOBS_QUEUE_NAME, AiSuggestReplyJobData, AiBaseJobData } from './ai.jobs';

@Injectable()
export class AiQueue implements OnModuleDestroy {
  private readonly queue?: Queue;
  private readonly enabled: boolean;

  constructor(configService: ConfigService) {
    this.enabled = process.env.NODE_ENV !== 'test' && isRedisConfigured(configService);
    if (this.enabled) {
      this.queue = new Queue(AI_JOBS_QUEUE_NAME, {
        connection: createRedisConnectionOptions(configService),
      });
    }
  }

  enqueueSummarizeLead(data: AiBaseJobData): Promise<void> {
    if (!this.enabled) {
      return Promise.resolve(undefined);
    }

    return this.queue!.add(AI_JOB_NAMES.SUMMARIZE_LEAD, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    }).then(() => undefined);
  }

  enqueueScorePriority(data: AiBaseJobData): Promise<void> {
    if (!this.enabled) {
      return Promise.resolve(undefined);
    }

    return this.queue!.add(AI_JOB_NAMES.SCORE_PRIORITY, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    }).then(() => undefined);
  }

  enqueueSuggestReply(data: AiSuggestReplyJobData): Promise<void> {
    if (!this.enabled) {
      return Promise.resolve(undefined);
    }

    return this.queue!.add(AI_JOB_NAMES.SUGGEST_REPLY, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    }).then(() => undefined);
  }

  async onModuleDestroy() {
    if (this.enabled) {
      await this.queue?.close();
    }
  }
}
