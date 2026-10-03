import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiConversation } from './ai-conversation.entity';
import { AiMessage } from './ai-message.entity';
import { GeminiChatService } from './gemini-chat.service';
import { BooksModule } from '../books/books.module';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { VocabularyCollectorService } from './vocabulary-collector.service';
import { VocabularyCollectorModelService } from './vocabulary-collector-model.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiConversation, AiMessage]),
    BooksModule,
    FlashcardsModule,
  ],
  controllers: [AiChatController],
  providers: [
    AiChatService,
    GeminiChatService,
    VocabularyCollectorService,
    VocabularyCollectorModelService,
  ],
  exports: [AiChatService],
})
export class AiChatModule {}
