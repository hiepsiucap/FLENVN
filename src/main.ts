import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  // Use Pino logger
  app.useLogger(logger);

  // Security
  app.use(helmet());

  // CORS
  const corsOrigins = configService.get<string>('CORS_ORIGINS')?.split(',') || [
    'http://localhost:3000',
  ];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-refresh-token'],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(
    `🚀 Application is running on: http://localhost:${port}/api/v1`,
    'Bootstrap',
  );
}

bootstrap().catch(error => {
  console.error('❌ Error starting server:', error);
  process.exit(1);
});
