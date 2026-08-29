import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookBackgroundService } from './book-background.service';
import { Book } from './book.entity';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Book]),
    SubscriptionsModule,
    UploadsModule,
  ],
  controllers: [BooksController],
  providers: [BooksService, BookBackgroundService],
  exports: [BooksService],
})
export class BooksModule {}
