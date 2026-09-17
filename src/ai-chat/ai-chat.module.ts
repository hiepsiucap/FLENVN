import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiConversation } from './ai-conversation.entity';
import { AiMessage } from './ai-message.entity';
import { GeminiChatService } from './gemini-chat.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiConversation, AiMessage])],
  controllers: [AiChatController],
  providers: [AiChatService, GeminiChatService],
  exports: [AiChatService],
})
export class AiChatModule {}
