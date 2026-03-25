import { SuggestReplyDto } from '../ai/dto/suggest-reply.dto';

export const AI_JOBS_QUEUE_NAME = 'ai-jobs';

export const AI_JOB_NAMES = {
  SUMMARIZE_LEAD: 'summarize-lead',
  SCORE_PRIORITY: 'score-priority',
  SUGGEST_REPLY: 'suggest-reply',
} as const;

export type AiJobName = (typeof AI_JOB_NAMES)[keyof typeof AI_JOB_NAMES];

export interface AiBaseJobData {
  businessId: string;
  leadId: string;
  conversationId?: string | null;
}

export interface AiSuggestReplyJobData extends AiBaseJobData {
  request: SuggestReplyDto;
}

export type AiJobData =
  | AiBaseJobData
  | AiSuggestReplyJobData;
