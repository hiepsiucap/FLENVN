import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
  PORT: Joi.number().default(3000),

  // Database Configuration
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),

  // JWT Configuration
  JWT_SECRET: Joi.string().min(24).required(),
  JWT_REFRESH_SECRET: Joi.string().min(24).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // AWS Configuration
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional(),

  // Cloudinary Configuration
  CLOUDINARY_CLOUD_NAME: Joi.string().optional(),
  CLOUDINARY_API_KEY: Joi.string().optional(),
  CLOUDINARY_API_SECRET: Joi.string().optional(),

  // OpenAI Configuration
  OPENAI_API_KEY: Joi.string().optional(),

  // Email Configuration
  EMAIL_HOST: Joi.string().optional(),
  EMAIL_PORT: Joi.number().optional(),
  EMAIL_USER: Joi.string().optional(),
  EMAIL_PASS: Joi.string().optional(),

  // Security
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
});
