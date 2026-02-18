import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configurationFiles from './config';
import { validationSchema } from './config/validation';
import { AppConfigService } from './config/app-config.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configurationFiles,
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
      expandVariables: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, AppConfigService],
  exports: [AppConfigService],
})
export class AppModule {}
