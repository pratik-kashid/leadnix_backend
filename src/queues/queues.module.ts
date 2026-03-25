import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';
import { AiQueue } from './ai.queue';
import { AiWorker } from './ai.worker';

@Module({
  imports: [ConfigModule, AiModule],
  providers: [AiQueue, AiWorker],
  exports: [AiQueue],
})
export class QueuesModule {}
