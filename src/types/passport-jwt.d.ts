declare module 'passport-jwt' {
  import type { Request } from 'express';
  import type { Strategy as PassportStrategy } from 'passport-strategy';

  export type JwtFromRequestFunction = (request: Request) => string | null;

  export interface StrategyOptions {
    jwtFromRequest: JwtFromRequestFunction;
    secretOrKey: string | Buffer;
    ignoreExpiration?: boolean;
  }

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions);
  }

  export const ExtractJwt: {
    fromAuthHeaderAsBearerToken(): JwtFromRequestFunction;
  };
}
