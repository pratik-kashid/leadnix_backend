import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';

@ApiTags('conversations')
@Controller('conversations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiBody({ type: CreateConversationDto })
  @ApiCreatedResponse({ type: ConversationResponseDto })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateConversationDto): Promise<ConversationResponseDto> {
    return this.conversationsService.create(user.sub, dto);
  }

  @Get('lead/:leadId')
  @ApiOkResponse({ type: [ConversationResponseDto] })
  findByLead(@CurrentUser() user: JwtPayload, @Param('leadId') leadId: string): Promise<ConversationResponseDto[]> {
    return this.conversationsService.findByLead(user.sub, leadId);
  }

  @Get(':id')
  @ApiOkResponse({ type: ConversationResponseDto })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<ConversationResponseDto> {
    return this.conversationsService.findOne(user.sub, id);
  }
}
