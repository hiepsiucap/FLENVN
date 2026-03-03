import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getLoggerConfig } from './common/logger.config';

async function bootstrap() {
  const loggerConfig = getLoggerConfig(process.env.NODE_ENV || 'development');
  const app = await NestFactory.create(AppModule, loggerConfig);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

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

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('FLENVN API')
    .setDescription('API documentation for the FLENVN backend services')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT access token',
      },
      'jwt-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(
    `🚀 Application is running on: http://localhost:${port}/api/v1`,
    'Bootstrap',
  );
  logger.log(
    `📚 Swagger docs available at: http://localhost:${port}/docs`,
    'Bootstrap',
  );
}

bootstrap().catch(error => {
  console.error('❌ Error starting server:', error);
  process.exit(1);
});
