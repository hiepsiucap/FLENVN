import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  globalPrefix: 'api/v1',

  // CORS configuration
  cors: {
    enabled: true,
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },

  // Rate limiting
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10), // 1 minute
    limit: parseInt(process.env.THROTTLE_LIMIT || '10', 10), // 10 requests per minute
  },

  // File upload configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
    ],
  },

  // Pagination defaults
  pagination: {
    defaultLimit: parseInt(process.env.DEFAULT_PAGE_LIMIT || '20', 10),
    maxLimit: parseInt(process.env.MAX_PAGE_LIMIT || '100', 10),
  },
}));
