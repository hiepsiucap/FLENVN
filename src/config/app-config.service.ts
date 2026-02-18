import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  // App Configuration
  get nodeEnv(): string {
    return this.configService.get<string>('app.nodeEnv', 'development');
  }

  get port(): number {
    return this.configService.get<number>('app.port', 3000);
  }

  get globalPrefix(): string {
    return this.configService.get<string>('app.globalPrefix', 'api/v1');
  }

  get corsOrigins(): string[] {
    return this.configService.get<string[]>('app.cors.origin', [
      'http://localhost:3000',
    ]);
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  // Throttle Configuration
  get throttleTtl(): number {
    return this.configService.get<number>('app.throttle.ttl', 60000);
  }

  get throttleLimit(): number {
    return this.configService.get<number>('app.throttle.limit', 10);
  }

  // Upload Configuration
  get maxFileSize(): number {
    return this.configService.get<number>('app.upload.maxFileSize', 5242880);
  }

  get allowedMimeTypes(): string[] {
    return this.configService.get<string[]>('app.upload.allowedMimeTypes', [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ]);
  }

  // Pagination Configuration
  get defaultPageLimit(): number {
    return this.configService.get<number>('app.pagination.defaultLimit', 20);
  }

  get maxPageLimit(): number {
    return this.configService.get<number>('app.pagination.maxLimit', 100);
  }

  // Database Configuration
  get dbHost(): string {
    return this.configService.get<string>('database.host', 'localhost');
  }

  get dbPort(): number {
    return this.configService.get<number>('database.port', 5432);
  }

  get dbName(): string {
    return this.configService.get<string>('database.database', '');
  }

  // JWT Configuration
  get jwtAccessSecret(): string {
    return this.configService.get<string>('auth.jwt.access.secret', '');
  }

  get jwtRefreshSecret(): string {
    return this.configService.get<string>('auth.jwt.refresh.secret', '');
  }

  get jwtAccessExpiresIn(): string {
    return this.configService.get<string>('auth.jwt.access.expiresIn', '15m');
  }

  get jwtRefreshExpiresIn(): string {
    return this.configService.get<string>('auth.jwt.refresh.expiresIn', '7d');
  }

  // Bcrypt Configuration
  get bcryptSaltRounds(): number {
    return this.configService.get<number>('auth.bcrypt.saltRounds', 12);
  }

  // Session Configuration
  get sessionSecret(): string {
    return this.configService.get<string>(
      'auth.session.secret',
      'fallback-secret-key',
    );
  }

  get sessionName(): string {
    return this.configService.get<string>('auth.session.name', 'flennest.sid');
  }

  get sessionMaxAge(): number {
    return this.configService.get<number>(
      'auth.session.cookie.maxAge',
      86400000,
    );
  }

  // Services Configuration
  get awsRegion(): string {
    return this.configService.get<string>('services.aws.region', 'us-east-1');
  }

  get awsS3Bucket(): string {
    return this.configService.get<string>('services.aws.s3.bucket', '');
  }

  get cloudinaryFolder(): string {
    return this.configService.get<string>(
      'services.cloudinary.folder',
      'flennest',
    );
  }

  get openaiApiKey(): string {
    return this.configService.get<string>('services.openai.apiKey', '');
  }

  get openaiModel(): string {
    return this.configService.get<string>(
      'services.openai.model',
      'gpt-3.5-turbo',
    );
  }

  get openaiMaxTokens(): number {
    return this.configService.get<number>('services.openai.maxTokens', 1000);
  }

  get openaiTemperature(): number {
    return this.configService.get<number>('services.openai.temperature', 0.7);
  }

  get redisHost(): string {
    return this.configService.get<string>('services.redis.host', 'localhost');
  }

  get redisPort(): number {
    return this.configService.get<number>('services.redis.port', 6379);
  }

  get redisTtl(): number {
    return this.configService.get<number>('services.redis.ttl', 3600);
  }

  get emailFrom(): string {
    return this.configService.get<string>(
      'services.email.from',
      'noreply@flennest.com',
    );
  }

  get emailService(): string {
    return this.configService.get<string>('services.email.service', 'gmail');
  }

  get emailPort(): number {
    return this.configService.get<number>('services.email.port', 587);
  }

  // Utility methods
  getOrThrow<T = any>(key: string): T {
    return this.configService.getOrThrow<T>(key);
  }

  // Validation methods
  validateRequiredSecrets(): void {
    const requiredSecrets = [
      'auth.jwt.access.secret',
      'auth.jwt.refresh.secret',
      'database.host',
      'database.username',
      'database.password',
      'database.database',
    ];

    for (const secret of requiredSecrets) {
      if (!this.configService.get(secret)) {
        throw new Error(`Missing required configuration: ${secret}`);
      }
    }
  }

  // Environment checks
  hasAwsConfig(): boolean {
    return !!(
      this.configService.get('services.aws.accessKeyId') &&
      this.configService.get('services.aws.secretAccessKey')
    );
  }

  hasCloudinaryConfig(): boolean {
    return !!this.configService.get('services.cloudinary.url');
  }

  hasOpenaiConfig(): boolean {
    return !!this.configService.get('services.openai.apiKey');
  }

  hasRedisConfig(): boolean {
    return !!this.configService.get('services.redis.host');
  }

  hasEmailConfig(): boolean {
    return !!(
      this.configService.get('services.email.user') &&
      this.configService.get('services.email.pass')
    );
  }
}
