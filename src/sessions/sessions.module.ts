import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { Session } from './session.entity';
import { PracticeSession } from './practice-session.entity';
import { PracticeGameResult } from './practice-game-result.entity';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, PracticeSession, PracticeGameResult]),
    FlashcardsModule,
    UsersModule,
  ],
  providers: [SessionsService],
  controllers: [SessionsController],
  exports: [SessionsService],
})
export class SessionsModule {}
