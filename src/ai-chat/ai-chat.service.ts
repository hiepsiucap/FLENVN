import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConversation } from './ai-conversation.entity';
import { AiMessage, AiMessageRole } from './ai-message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import {
  ConversationPaginationDto,
  MessagePaginationDto,
} from './dto/pagination.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ChatHistoryMessage, GeminiChatService } from './gemini-chat.service';

@Injectable()
export class AiChatService {
  constructor(
    @InjectRepository(AiConversation)
    private readonly conversationRepository: Repository<AiConversation>,
    @InjectRepository(AiMessage)
    private readonly messageRepository: Repository<AiMessage>,
    private readonly geminiChatService: GeminiChatService,
    private readonly configService: ConfigService,
  ) {}

  createConversation(userId: string, dto: CreateConversationDto) {
    const conversation = this.conversationRepository.create({
      userId,
      title: dto.title?.trim() || 'New conversation',
      targetLanguage: dto.targetLanguage?.trim().toLowerCase() || 'en',
      englishLevel: dto.englishLevel || null,
    });
    return this.conversationRepository.save(conversation);
  }

  async listConversations(userId: string, query: ConversationPaginationDto) {
    const builder = this.conversationRepository
      .createQueryBuilder('conversation')
      .where('conversation.userId = :userId', { userId })
      .orderBy('conversation.updatedAt', 'DESC')
      .addOrderBy('conversation.id', 'DESC')
      .take(query.limit);

    if (query.cursor) {
      const cursor = await this.getOwnedConversation(userId, query.cursor);
      builder.andWhere(
        '(conversation.updatedAt < :cursorUpdatedAt OR (conversation.updatedAt = :cursorUpdatedAt AND conversation.id < :cursorId))',
        { cursorUpdatedAt: cursor.updatedAt, cursorId: cursor.id },
      );
    }

    const conversations = await builder.getMany();
    return {
      conversations,
      nextCursor:
        conversations.length === query.limit
          ? conversations[conversations.length - 1].id
          : null,
    };
  }

  async getMessages(
    userId: string,
    conversationId: string,
    query: MessagePaginationDto,
  ) {
    await this.getOwnedConversation(userId, conversationId);

    const builder = this.messageRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(query.limit);

    if (query.before) {
      const cursor = await this.messageRepository.findOne({
        where: { id: query.before, conversationId },
      });
      if (!cursor) throw new NotFoundException('Message cursor not found');
      builder.andWhere(
        '(message.createdAt < :cursorCreatedAt OR (message.createdAt = :cursorCreatedAt AND message.id < :cursorId))',
        { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id },
      );
    }

    const newestFirst = await builder.getMany();
    return {
      messages: [...newestFirst]
        .reverse()
        .map((message) => this.toPublicMessage(message)),
      nextCursor:
        newestFirst.length === query.limit
          ? newestFirst[newestFirst.length - 1].id
          : null,
    };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const conversation = await this.getOwnedConversation(
      userId,
      conversationId,
    );
    const content = dto.message.trim();
    const maxInputChars = this.configService.get<number>(
      'services.aiChat.maxInputChars',
      5000,
    );
    if (!content || content.length > maxInputChars) {
      throw new BadRequestException(
        `Message must contain between 1 and ${maxInputChars} characters`,
      );
    }

    let userMessage: AiMessage | null = null;
    if (dto.clientMessageId) {
      userMessage = await this.messageRepository.findOne({
        where: {
          conversationId,
          clientMessageId: dto.clientMessageId,
          role: AiMessageRole.USER,
        },
      });
      if (userMessage && userMessage.content !== content) {
        throw new ConflictException(
          'clientMessageId was already used for different content',
        );
      }
      if (userMessage) {
        const assistantMessage = await this.messageRepository.findOne({
          where: { replyToMessageId: userMessage.id },
        });
        if (assistantMessage) {
          return this.buildMessageResponse(userMessage, assistantMessage);
        }
      }
    }

    if (!userMessage) {
      userMessage = await this.messageRepository.save(
        this.messageRepository.create({
          conversationId,
          role: AiMessageRole.USER,
          content,
          clientMessageId: dto.clientMessageId || null,
          replyToMessageId: null,
          model: null,
          inputTokens: null,
          outputTokens: null,
        }),
      );
    }

    const history = await this.loadGeminiHistory(conversationId);
    const result = await this.geminiChatService.generateReply(
      history,
      conversation.targetLanguage,
      conversation.englishLevel,
    );
    const assistantMessage = await this.messageRepository.save(
      this.messageRepository.create({
        conversationId,
        role: AiMessageRole.ASSISTANT,
        content: result.content,
        clientMessageId: null,
        replyToMessageId: userMessage.id,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      }),
    );

    if (conversation.title === 'New conversation') {
      conversation.title = this.createTitle(content);
    }
    conversation.updatedAt = new Date();
    await this.conversationRepository.save(conversation);

    return this.buildMessageResponse(userMessage, assistantMessage);
  }

  async updateConversation(
    userId: string,
    conversationId: string,
    dto: UpdateConversationDto,
  ) {
    const conversation = await this.getOwnedConversation(
      userId,
      conversationId,
    );
    if (dto.title !== undefined) {
      conversation.title = dto.title.trim() || 'New conversation';
    }
    if (dto.targetLanguage !== undefined) {
      conversation.targetLanguage = dto.targetLanguage.trim().toLowerCase();
    }
    if (dto.englishLevel !== undefined) {
      conversation.englishLevel = dto.englishLevel;
    }
    return this.conversationRepository.save(conversation);
  }

  async deleteConversation(userId: string, conversationId: string) {
    const conversation = await this.getOwnedConversation(
      userId,
      conversationId,
    );
    await this.conversationRepository.remove(conversation);
    return { message: 'Conversation deleted successfully' };
  }

  private async getOwnedConversation(userId: string, id: string) {
    const conversation = await this.conversationRepository.findOne({
      where: { id, userId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  private async loadGeminiHistory(
    conversationId: string,
  ): Promise<ChatHistoryMessage[]> {
    const maxMessages = this.configService.get<number>(
      'services.aiChat.historyMessages',
      20,
    );
    const maxChars = this.configService.get<number>(
      'services.aiChat.historyChars',
      12000,
    );
    const newestFirst = await this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: maxMessages,
    });

    const selected: AiMessage[] = [];
    let characters = 0;
    for (const message of newestFirst) {
      if (
        selected.length > 0 &&
        characters + message.content.length > maxChars
      ) {
        break;
      }
      selected.push(message);
      characters += message.content.length;
    }

    return selected.reverse().map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }

  private createTitle(content: string): string {
    const singleLine = content.replace(/\s+/g, ' ').trim();
    return singleLine.length <= 60
      ? singleLine
      : `${singleLine.slice(0, 57).trimEnd()}...`;
  }

  private buildMessageResponse(
    userMessage: AiMessage,
    assistantMessage: AiMessage,
  ) {
    return {
      userMessage: this.toPublicMessage(userMessage),
      assistantMessage: this.toPublicMessage(assistantMessage),
      provider: 'gemini' as const,
      model: assistantMessage.model,
    };
  }

  private toPublicMessage(message: AiMessage) {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    };
  }
}
