import { BadGatewayException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import OpenAI from 'openai';
import { In, Repository } from 'typeorm';
import { AiRun } from './entities/ai-run.entity';
import { TeamMembersService } from '../team-members/team-members.service';
import { Lead } from '../leads/entities/lead.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { AiRunStatus } from '../common/enums/ai-run-status.enum';
import { AiRunType } from '../common/enums/ai-run-type.enum';
import { SuggestReplyDto } from './dto/suggest-reply.dto';
import { LeadSummaryResponseDto } from './dto/lead-summary-response.dto';
import { ReplySuggestionResponseDto } from './dto/reply-suggestion-response.dto';
import { PriorityScoreResponseDto } from './dto/priority-score-response.dto';
import { LeadPriority } from '../common/enums/lead-priority.enum';

type LeadContext = {
  businessId: string;
  lead: {
    id: string;
    title: string;
    source: string;
    status: string;
    priority: string;
    notes: string | null;
    assignedToUserId: string | null;
    lastMessageAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    socialHandle: string | null;
    source: string | null;
  };
  latestConversation: {
    id: string;
    channelType: string;
    externalThreadId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  recentMessages: Array<{
    id: string;
    senderType: string;
    direction: string;
    content: string;
    messageType: string;
    sentAt: Date | null;
    createdAt: Date;
  }>;
};

@Injectable()
export class AiService {
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(
    @InjectRepository(AiRun)
    private readonly aiRunsRepository: Repository<AiRun>,
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    private readonly teamMembersService: TeamMembersService,
    configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: configService.getOrThrow<string>('OPENAI_API_KEY'),
    });
    this.model = configService.get<string>('OPENAI_MODEL') ?? 'gpt-5.2';
  }

  async summarizeLead(userId: string, leadId: string): Promise<LeadSummaryResponseDto> {
    const context = await this.buildLeadContext(userId, leadId);
    const { run, output } = await this.executeStructuredRun<{
      summary: string;
      highlights: string[];
      risks: string[];
      nextAction: string;
      confidence: number;
    }>(
      AiRunType.LEAD_SUMMARY,
      context,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          summary: { type: 'string' },
          highlights: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
          nextAction: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['summary', 'highlights', 'risks', 'nextAction', 'confidence'],
      },
      `You are Leadnix's AI assistant.
Summarize the lead context below in concise, actionable JSON only.
Use the lead status, notes, source, contact details, latest conversation, and recent messages to produce a compact summary.

Lead context:
${JSON.stringify(context, null, 2)}`,
    );

    return {
      aiRunId: run.id,
      model: run.model,
      summary: output.summary,
      highlights: output.highlights,
      risks: output.risks,
      nextAction: output.nextAction,
      confidence: output.confidence,
    };
  }

  async summarizeLeadForBusiness(businessId: string, leadId: string): Promise<LeadSummaryResponseDto> {
    const context = await this.buildLeadContextByBusinessId(businessId, leadId);
    const { run, output } = await this.executeStructuredRun<{
      summary: string;
      highlights: string[];
      risks: string[];
      nextAction: string;
      confidence: number;
    }>(
      AiRunType.LEAD_SUMMARY,
      context,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          summary: { type: 'string' },
          highlights: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
          nextAction: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['summary', 'highlights', 'risks', 'nextAction', 'confidence'],
      },
      `You are Leadnix's AI assistant.
Summarize the lead context below in concise, actionable JSON only.
Use the lead status, notes, source, contact details, latest conversation, and recent messages to produce a compact summary.

Lead context:
${JSON.stringify(context, null, 2)}`,
    );

    return {
      aiRunId: run.id,
      model: run.model,
      summary: output.summary,
      highlights: output.highlights,
      risks: output.risks,
      nextAction: output.nextAction,
      confidence: output.confidence,
    };
  }

  async suggestReply(userId: string, leadId: string, dto: SuggestReplyDto): Promise<ReplySuggestionResponseDto> {
    const context = await this.buildLeadContext(userId, leadId);
    const { run, output } = await this.executeStructuredRun<{
      suggestedReply: string;
      reasoning: string[];
    }>(
      AiRunType.SUGGEST_REPLY,
      { ...context, preferences: dto },
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          suggestedReply: { type: 'string' },
          reasoning: { type: 'array', items: { type: 'string' } },
        },
        required: ['suggestedReply', 'reasoning'],
      },
      `You are Leadnix's AI assistant.
Draft a helpful reply suggestion for the lead. Do not send any message.
Respect these preferences if provided: tone=${dto.tone ?? 'unspecified'}, goal=${dto.goal ?? 'unspecified'}, language=${dto.language ?? 'unspecified'}.
Return JSON only.

Lead context:
${JSON.stringify(context, null, 2)}`,
    );

    return {
      aiRunId: run.id,
      model: run.model,
      tone: dto.tone,
      goal: dto.goal,
      language: dto.language,
      suggestedReply: output.suggestedReply,
      reasoning: output.reasoning,
    };
  }

  async suggestReplyForBusiness(
    businessId: string,
    leadId: string,
    dto: SuggestReplyDto,
  ): Promise<ReplySuggestionResponseDto> {
    const context = await this.buildLeadContextByBusinessId(businessId, leadId);
    const { run, output } = await this.executeStructuredRun<{
      suggestedReply: string;
      reasoning: string[];
    }>(
      AiRunType.SUGGEST_REPLY,
      { ...context, preferences: dto },
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          suggestedReply: { type: 'string' },
          reasoning: { type: 'array', items: { type: 'string' } },
        },
        required: ['suggestedReply', 'reasoning'],
      },
      `You are Leadnix's AI assistant.
Draft a helpful reply suggestion for the lead. Do not send any message.
Respect these preferences if provided: tone=${dto.tone ?? 'unspecified'}, goal=${dto.goal ?? 'unspecified'}, language=${dto.language ?? 'unspecified'}.
Return JSON only.

Lead context:
${JSON.stringify(context, null, 2)}`,
    );

    return {
      aiRunId: run.id,
      model: run.model,
      tone: dto.tone,
      goal: dto.goal,
      language: dto.language,
      suggestedReply: output.suggestedReply,
      reasoning: output.reasoning,
    };
  }

  async scorePriority(userId: string, leadId: string): Promise<PriorityScoreResponseDto> {
    const context = await this.buildLeadContext(userId, leadId);
    const { run, output } = await this.executeStructuredRun<{
      score: number;
      priority: LeadPriority;
      reasons: string[];
      recommendedAction: string;
    }>(
      AiRunType.SCORE_PRIORITY,
      context,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          score: { type: 'number' },
          priority: { type: 'string', enum: Object.values(LeadPriority) },
          reasons: { type: 'array', items: { type: 'string' } },
          recommendedAction: { type: 'string' },
        },
        required: ['score', 'priority', 'reasons', 'recommendedAction'],
      },
      `You are Leadnix's AI assistant.
Score this lead's priority from 0 to 100 and map it to LOW, MEDIUM, or HIGH.
Return JSON only.

Lead context:
${JSON.stringify(context, null, 2)}`,
    );

    return {
      aiRunId: run.id,
      model: run.model,
      score: output.score,
      priority: output.priority,
      reasons: output.reasons,
      recommendedAction: output.recommendedAction,
    };
  }

  async scorePriorityForBusiness(businessId: string, leadId: string): Promise<PriorityScoreResponseDto> {
    const context = await this.buildLeadContextByBusinessId(businessId, leadId);
    const { run, output } = await this.executeStructuredRun<{
      score: number;
      priority: LeadPriority;
      reasons: string[];
      recommendedAction: string;
    }>(
      AiRunType.SCORE_PRIORITY,
      context,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          score: { type: 'number' },
          priority: { type: 'string', enum: Object.values(LeadPriority) },
          reasons: { type: 'array', items: { type: 'string' } },
          recommendedAction: { type: 'string' },
        },
        required: ['score', 'priority', 'reasons', 'recommendedAction'],
      },
      `You are Leadnix's AI assistant.
Score this lead's priority from 0 to 100 and map it to LOW, MEDIUM, or HIGH.
Return JSON only.

Lead context:
${JSON.stringify(context, null, 2)}`,
    );

    return {
      aiRunId: run.id,
      model: run.model,
      score: output.score,
      priority: output.priority,
      reasons: output.reasons,
      recommendedAction: output.recommendedAction,
    };
  }

  private async buildLeadContext(userId: string, leadId: string): Promise<LeadContext> {
    const businessIds = await this.getAccessibleBusinessIds(userId);
    const lead = await this.leadsRepository.findOne({
      where: { id: leadId, businessId: In(businessIds) },
      relations: { contact: true },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const latestConversation = await this.conversationsRepository.findOne({
      where: { leadId: lead.id, businessId: lead.businessId },
      order: { createdAt: 'DESC' },
    });

    const recentMessages = latestConversation
      ? await this.messagesRepository.find({
          where: { conversationId: latestConversation.id, businessId: lead.businessId },
          order: { createdAt: 'DESC' },
          take: 10,
        })
      : [];

    return {
      businessId: lead.businessId,
      lead: {
        id: lead.id,
        title: lead.title,
        source: lead.source,
        status: lead.status,
        priority: lead.priority,
        notes: lead.notes,
        assignedToUserId: lead.assignedToUserId,
        lastMessageAt: lead.lastMessageAt,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      },
      contact: {
        id: lead.contact.id,
        name: lead.contact.name,
        phone: lead.contact.phone,
        email: lead.contact.email,
        socialHandle: lead.contact.socialHandle,
        source: lead.contact.source,
      },
      latestConversation: latestConversation
        ? {
            id: latestConversation.id,
            channelType: latestConversation.channelType,
            externalThreadId: latestConversation.externalThreadId,
            createdAt: latestConversation.createdAt,
            updatedAt: latestConversation.updatedAt,
          }
        : null,
      recentMessages: recentMessages
        .reverse()
        .map((message) => ({
          id: message.id,
          senderType: message.senderType,
          direction: message.direction,
          content: message.content,
          messageType: message.messageType,
          sentAt: message.sentAt,
          createdAt: message.createdAt,
        })),
    };
  }

  private async buildLeadContextByBusinessId(businessId: string, leadId: string): Promise<LeadContext> {
    const lead = await this.leadsRepository.findOne({
      where: { id: leadId, businessId },
      relations: { contact: true },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const latestConversation = await this.conversationsRepository.findOne({
      where: { leadId: lead.id, businessId: lead.businessId },
      order: { createdAt: 'DESC' },
    });

    const recentMessages = latestConversation
      ? await this.messagesRepository.find({
          where: { conversationId: latestConversation.id, businessId: lead.businessId },
          order: { createdAt: 'DESC' },
          take: 10,
        })
      : [];

    return {
      businessId: lead.businessId,
      lead: {
        id: lead.id,
        title: lead.title,
        source: lead.source,
        status: lead.status,
        priority: lead.priority,
        notes: lead.notes,
        assignedToUserId: lead.assignedToUserId,
        lastMessageAt: lead.lastMessageAt,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      },
      contact: {
        id: lead.contact.id,
        name: lead.contact.name,
        phone: lead.contact.phone,
        email: lead.contact.email,
        socialHandle: lead.contact.socialHandle,
        source: lead.contact.source,
      },
      latestConversation: latestConversation
        ? {
            id: latestConversation.id,
            channelType: latestConversation.channelType,
            externalThreadId: latestConversation.externalThreadId,
            createdAt: latestConversation.createdAt,
            updatedAt: latestConversation.updatedAt,
          }
        : null,
      recentMessages: recentMessages
        .reverse()
        .map((message) => ({
          id: message.id,
          senderType: message.senderType,
          direction: message.direction,
          content: message.content,
          messageType: message.messageType,
          sentAt: message.sentAt,
          createdAt: message.createdAt,
        })),
    };
  }

  private async getAccessibleBusinessIds(userId: string): Promise<string[]> {
    const memberships = await this.teamMembersService.findByUserId(userId);
    const businessIds = [...new Set(memberships.map((membership) => membership.businessId))];

    if (!businessIds.length) {
      throw new ForbiddenException('No accessible businesses found');
    }

    return businessIds;
  }

  private async createAiRun(input: {
    businessId: string;
    leadId: string;
    conversationId: string | null;
    type: AiRunType;
    inputJson: Record<string, unknown>;
  }): Promise<AiRun> {
    return this.aiRunsRepository.save(
      this.aiRunsRepository.create({
        businessId: input.businessId,
        leadId: input.leadId,
        conversationId: input.conversationId,
        type: input.type,
        model: this.model,
        inputJson: input.inputJson,
        outputJson: null,
        status: AiRunStatus.PENDING,
        latencyMs: null,
        errorMessage: null,
      }),
    );
  }

  private async executeStructuredRun<T>(
    type: AiRunType,
    context: LeadContext & { preferences?: SuggestReplyDto },
    schema: Record<string, unknown>,
    prompt: string,
  ): Promise<{ run: AiRun; output: T }> {
    const run = await this.createAiRun({
      businessId: context.businessId,
      leadId: context.lead.id,
      conversationId: context.latestConversation?.id ?? null,
      type,
      inputJson: context as Record<string, unknown>,
    });

    const startedAt = Date.now();

    try {
      const response = await this.openai.responses.create({
        model: this.model,
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: type.toLowerCase(),
            schema,
            strict: true,
          },
        },
        max_output_tokens: 800,
      });

      const raw = response.output_text;
      if (!raw) {
        throw new Error('Empty AI response');
      }

      const parsed = JSON.parse(raw) as T;
      run.status = AiRunStatus.SUCCESS;
      run.outputJson = parsed as Record<string, unknown>;
      run.latencyMs = Date.now() - startedAt;
      run.errorMessage = null;
      await this.aiRunsRepository.save(run);

      return { run, output: parsed };
    } catch (error) {
      run.status = AiRunStatus.FAILED;
      run.latencyMs = Date.now() - startedAt;
      run.errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
      await this.aiRunsRepository.save(run);
      throw new BadGatewayException(`AI request failed: ${run.errorMessage}`);
    }
  }
}
