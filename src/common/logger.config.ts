import { LogLevel } from '@nestjs/common';

export const getLoggerConfig = (environment: string) => {
  const logLevels: LogLevel[] =
    environment === 'development'
      ? ['log', 'debug', 'error', 'verbose', 'warn']
      : ['log', 'error', 'warn'];

  return {
    logger: logLevels,
  };
};
