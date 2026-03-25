import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { AiService } from './ai.service';
import { SuggestReplyDto } from './dto/suggest-reply.dto';
import { LeadSummaryResponseDto } from './dto/lead-summary-response.dto';
import { ReplySuggestionResponseDto } from './dto/reply-suggestion-response.dto';
import { PriorityScoreResponseDto } from './dto/priority-score-response.dto';

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('leads/:leadId/summarize')
  @ApiOkResponse({ type: LeadSummaryResponseDto })
  summarizeLead(@CurrentUser() user: JwtPayload, @Param('leadId') leadId: string): Promise<LeadSummaryResponseDto> {
    return this.aiService.summarizeLead(user.sub, leadId);
  }

  @Post('leads/:leadId/suggest-reply')
  @ApiBody({ type: SuggestReplyDto })
  @ApiOkResponse({ type: ReplySuggestionResponseDto })
  suggestReply(
    @CurrentUser() user: JwtPayload,
    @Param('leadId') leadId: string,
    @Body() dto: SuggestReplyDto,
  ): Promise<ReplySuggestionResponseDto> {
    return this.aiService.suggestReply(user.sub, leadId, dto);
  }

  @Post('leads/:leadId/score-priority')
  @ApiOkResponse({ type: PriorityScoreResponseDto })
  scorePriority(@CurrentUser() user: JwtPayload, @Param('leadId') leadId: string): Promise<PriorityScoreResponseDto> {
    return this.aiService.scorePriority(user.sub, leadId);
  }
}
