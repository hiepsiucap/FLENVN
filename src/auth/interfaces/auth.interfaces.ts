import { User } from 'src/users/user.entity';
import type { UserRank } from 'src/users/user-rank';

export type SanitizedUser = Omit<
  User,
  | 'password'
  | 'emailVerificationToken'
  | 'passwordResetToken'
  | 'passwordResetExpires'
> & { rank: UserRank };

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  avatar: string;
  level: number;
  exp: number;
  streak: number;
  lastActive: Date | null;
  isAdmin: boolean;
  rank: UserRank;
}

export interface JwtPayload {
  sub: string; // user ID
  iat?: number; // issued at
  exp?: number; // expiration time
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  message: string;
}
