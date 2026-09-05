import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import configurationFiles from './config';
import { AppConfigService } from './config/app-config.service';
import { validationSchema } from './config/validation';
import { getDatabaseConfig } from './database/database.config';
import { UsersModule } from './users/users.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { BooksModule } from './books/books.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { SessionsModule } from './sessions/sessions.module';
import { TranslateModule } from './translate/translate.module';
import { UploadsModule } from './uploads/uploads.module';
import { WordsModule } from './words/words.module';
import { LabelsModule } from './labels/labels.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: configurationFiles,
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
      expandVariables: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per ttl
      },
    ]),

    // Feature Modules
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    BooksModule,
    FlashcardsModule,
    SessionsModule,
    TranslateModule,
    UploadsModule,
    WordsModule,
    LabelsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppConfigService,
    // Global providers
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    },
  ],
  exports: [AppConfigService],
})
export class AppModule {}
