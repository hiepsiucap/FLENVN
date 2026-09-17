import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AiChatService } from './ai-chat.service';
import { AiConversation } from './ai-conversation.entity';
import { AiMessage, AiMessageRole } from './ai-message.entity';
import { GeminiChatService } from './gemini-chat.service';

describe('AiChatService', () => {
  const conversation = {
    id: 'conversation-1',
    userId: 'user-1',
    title: 'New conversation',
    targetLanguage: 'vi',
    englishLevel: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  } as AiConversation;

  const createHarness = () => {
    const conversationRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      findOne: jest.fn().mockResolvedValue({ ...conversation }),
      remove: jest.fn(),
    } as unknown as jest.Mocked<Repository<AiConversation>>;
    const messageRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value: Partial<AiMessage>) => ({
        ...value,
        id:
          value.role === AiMessageRole.USER
            ? 'user-message-1'
            : 'assistant-message-1',
        createdAt: new Date(),
      })),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([
        {
          id: 'user-message-1',
          role: AiMessageRole.USER,
          content: 'Explain say and tell',
          createdAt: new Date(),
        },
      ]),
    } as unknown as jest.Mocked<Repository<AiMessage>>;
    const geminiChatService = {
      generateReply: jest.fn().mockResolvedValue({
        content: 'They are used differently.',
        model: 'gemini-primary',
        inputTokens: 10,
        outputTokens: 5,
      }),
    } as unknown as jest.Mocked<GeminiChatService>;
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, number> = {
          'services.aiChat.maxInputChars': 5000,
          'services.aiChat.historyMessages': 20,
          'services.aiChat.historyChars': 12000,
        };
        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;

    return {
      service: new AiChatService(
        conversationRepository,
        messageRepository,
        geminiChatService,
        configService,
      ),
      conversationRepository,
      messageRepository,
      geminiChatService,
    };
  };

  it('creates a conversation with optional preferences', async () => {
    const { service, conversationRepository } = createHarness();
    await service.createConversation('user-1', {});
    expect(conversationRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      title: 'New conversation',
      targetLanguage: 'en',
      englishLevel: null,
    });
  });

  it('sends bounded history to Gemini and persists the response', async () => {
    const {
      service,
      messageRepository,
      geminiChatService,
      conversationRepository,
    } = createHarness();

    const result = await service.sendMessage('user-1', 'conversation-1', {
      message: 'Explain say and tell',
      clientMessageId: '014900a8-7040-4f85-9867-c2c788ddc553',
    });

    expect(geminiChatService.generateReply).toHaveBeenCalledWith(
      [{ role: AiMessageRole.USER, content: 'Explain say and tell' }],
      'vi',
      null,
    );
    expect(messageRepository.save).toHaveBeenCalledTimes(2);
    expect(conversationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Explain say and tell' }),
    );
    expect(result).toMatchObject({
      provider: 'gemini',
      model: 'gemini-primary',
    });
  });

  it('returns the existing exchange for an idempotent retry', async () => {
    const { service, messageRepository, geminiChatService } = createHarness();
    const userMessage = {
      id: 'user-message-1',
      conversationId: 'conversation-1',
      role: AiMessageRole.USER,
      content: 'Hello',
      clientMessageId: '014900a8-7040-4f85-9867-c2c788ddc553',
    } as AiMessage;
    const assistantMessage = {
      id: 'assistant-message-1',
      conversationId: 'conversation-1',
      role: AiMessageRole.ASSISTANT,
      content: 'Hi!',
      model: 'gemini-primary',
      replyToMessageId: userMessage.id,
    } as AiMessage;
    messageRepository.findOne
      .mockResolvedValueOnce(userMessage)
      .mockResolvedValueOnce(assistantMessage);

    await expect(
      service.sendMessage('user-1', 'conversation-1', {
        message: 'Hello',
        clientMessageId: userMessage.clientMessageId!,
      }),
    ).resolves.toMatchObject({
      assistantMessage: {
        id: assistantMessage.id,
        role: AiMessageRole.ASSISTANT,
        content: 'Hi!',
      },
    });
    expect(geminiChatService.generateReply).not.toHaveBeenCalled();
    expect(messageRepository.save).not.toHaveBeenCalled();
  });

  it('rejects reuse of an idempotency key with different content', async () => {
    const { service, messageRepository } = createHarness();
    messageRepository.findOne.mockResolvedValueOnce({
      id: 'user-message-1',
      conversationId: 'conversation-1',
      role: AiMessageRole.USER,
      content: 'Original',
    } as AiMessage);

    await expect(
      service.sendMessage('user-1', 'conversation-1', {
        message: 'Different',
        clientMessageId: '014900a8-7040-4f85-9867-c2c788ddc553',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('hides conversations that are not owned by the user', async () => {
    const { service, conversationRepository } = createHarness();
    conversationRepository.findOne.mockResolvedValueOnce(null);
    await expect(
      service.getMessages('user-1', 'conversation-2', { limit: 50 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
