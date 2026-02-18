import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  type: 'postgres' as const,

  // Connection pool settings
  extra: {
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000', 10),
    timeout: parseInt(process.env.DB_TIMEOUT || '60000', 10),
  },

  // TypeORM specific settings
  synchronize: process.env.NODE_ENV === 'development',
  logging:
    process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  migrations: ['dist/migrations/*.js'],
  entities: ['dist/**/*.entity.js'],
  cli: {
    migrationsDir: 'src/migrations',
    entitiesDir: 'src/**/*.entity.ts',
  },

  // SSL configuration
  ssl:
    process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
      : false,
}));
