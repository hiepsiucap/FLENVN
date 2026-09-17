import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/user.entity';
import { AiChatService } from './ai-chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import {
  ConversationPaginationDto,
  MessagePaginationDto,
} from './dto/pagination.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@ApiTags('AI Chat')
@ApiBearerAuth('jwt-auth')
@Controller('ai/conversations')
@UseGuards(JwtAuthGuard)
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post()
  @ApiOperation({ summary: 'Create an AI conversation' })
  createConversation(
    @CurrentUser() user: User,
    @Body() dto: CreateConversationDto,
  ) {
    return this.aiChatService.createConversation(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the current user conversations' })
  listConversations(
    @CurrentUser() user: User,
    @Query() query: ConversationPaginationDto,
  ) {
    return this.aiChatService.listConversations(user.id, query);
  }

  @Get(':conversationId/messages')
  @ApiOperation({ summary: 'Get conversation messages' })
  getMessages(
    @CurrentUser() user: User,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: MessagePaginationDto,
  ) {
    return this.aiChatService.getMessages(user.id, conversationId, query);
  }

  @Post(':conversationId/messages')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: () => Number(process.env.AI_CHAT_RATE_LIMIT_PER_MINUTE || '10'),
      ttl: 60000,
    },
  })
  @ApiOperation({ summary: 'Send a message to Gemini' })
  sendMessage(
    @CurrentUser() user: User,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.aiChatService.sendMessage(user.id, conversationId, dto);
  }

  @Patch(':conversationId')
  @ApiOperation({ summary: 'Update conversation settings' })
  updateConversation(
    @CurrentUser() user: User,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.aiChatService.updateConversation(user.id, conversationId, dto);
  }

  @Delete(':conversationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a conversation and its messages' })
  deleteConversation(
    @CurrentUser() user: User,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.aiChatService.deleteConversation(user.id, conversationId);
  }
}
