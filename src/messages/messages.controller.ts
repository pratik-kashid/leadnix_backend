import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { PaginatedMessagesResponseDto } from './dto/paginated-messages-response.dto';

@ApiTags('messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('send')
  @ApiBody({ type: SendMessageDto })
  @ApiCreatedResponse({ type: MessageResponseDto })
  send(@CurrentUser() user: JwtPayload, @Body() dto: SendMessageDto): Promise<MessageResponseDto> {
    return this.messagesService.send(user.sub, dto);
  }

  @Get()
  @ApiOkResponse({ type: PaginatedMessagesResponseDto })
  findByConversation(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryMessagesDto,
  ): Promise<PaginatedMessagesResponseDto> {
    return this.messagesService.findByConversation(user.sub, query);
  }
}
