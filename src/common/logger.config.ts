import { Request, Response } from 'express';
import { LoggerModule } from 'nestjs-pino';

interface RequestWithId extends Request {
  id: string;
}

export const getLoggerConfig = (environment: string) =>
  LoggerModule.forRoot({
    pinoHttp: {
      transport:
        environment === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true,
                levelFirst: false,
                translateTime: 'yyyy-mm-dd HH:MM:ss.l',
                messageFormat: '{msg}',
                ignore: 'pid,hostname',
                errorLikeObjectKeys: ['err', 'error'],
              },
            }
          : undefined,
      level: environment === 'development' ? 'debug' : 'info',
      redact: {
        paths: ['req.headers.authorization', 'req.headers["x-refresh-token"]'],
        censor: '***REDACTED***',
      },
      serializers: {
        req: (req: RequestWithId) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          params: req.params,
          query: req.query,
          remoteAddress: req.socket?.remoteAddress,
          remotePort: req.socket?.remotePort,
        }),
        res: (res: Response) => ({
          statusCode: res.statusCode,
        }),
      },
    },
  });
