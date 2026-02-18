import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // App Configuration
  NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().optional(),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(10),
  MAX_FILE_SIZE: Joi.number().default(5242880), // 5MB
  DEFAULT_PAGE_LIMIT: Joi.number().default(20),
  MAX_PAGE_LIMIT: Joi.number().default(100),

  // Database Configuration
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_CONNECTION_LIMIT: Joi.number().default(10),
  DB_ACQUIRE_TIMEOUT: Joi.number().default(60000),
  DB_TIMEOUT: Joi.number().default(60000),
  DB_SSL: Joi.string().valid('true', 'false').default('false'),
  DB_SSL_REJECT_UNAUTHORIZED: Joi.string()
    .valid('true', 'false')
    .default('true'),

  // JWT Configuration
  JWT_ACCESS_SECRET: Joi.string().min(24).required(),
  JWT_REFRESH_SECRET: Joi.string().min(24).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),
  BCRYPT_SALT_ROUNDS: Joi.number().default(12),

  // Session Configuration
  SESSION_SECRET: Joi.string().min(16).optional(),
  SESSION_NAME: Joi.string().default('flennest.sid'),
  SESSION_MAX_AGE: Joi.number().default(86400000), // 24 hours

  // OAuth Configuration
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().optional(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().optional(),
  GITHUB_CLIENT_ID: Joi.string().optional(),
  GITHUB_CLIENT_SECRET: Joi.string().optional(),
  GITHUB_CALLBACK_URL: Joi.string().uri().optional(),

  // AWS Configuration
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
  AWS_S3_BUCKET: Joi.string().optional(),
  AWS_S3_REGION: Joi.string().optional(),
  AWS_S3_SIGNED_URL_EXPIRES: Joi.number().default(3600),
  AWS_SES_REGION: Joi.string().optional(),
  AWS_SES_FROM_EMAIL: Joi.string().email().optional(),

  // Cloudinary Configuration
  CLOUDINARY_URL: Joi.string().uri().optional(),
  CLOUDINARY_CLOUD_NAME: Joi.string().optional(),
  CLOUDINARY_API_KEY: Joi.string().optional(),
  CLOUDINARY_API_SECRET: Joi.string().optional(),
  CLOUDINARY_FOLDER: Joi.string().default('flennest'),

  // OpenAI Configuration
  OPENAI_API_KEY: Joi.string().optional(),
  OPENAI_MODEL: Joi.string().default('gpt-3.5-turbo'),
  OPENAI_MAX_TOKENS: Joi.number().default(1000),
  OPENAI_TEMPERATURE: Joi.number().min(0).max(2).default(0.7),

  // Redis Configuration
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_DB: Joi.number().default(0),
  REDIS_TTL: Joi.number().default(3600),

  // Email Configuration
  EMAIL_SERVICE: Joi.string().default('gmail'),
  EMAIL_HOST: Joi.string().optional(),
  EMAIL_PORT: Joi.number().default(587),
  EMAIL_SECURE: Joi.string().valid('true', 'false').default('false'),
  EMAIL_USER: Joi.string().email().optional(),
  EMAIL_PASS: Joi.string().optional(),
  EMAIL_FROM: Joi.string().email().default('noreply@flennest.com'),
});
