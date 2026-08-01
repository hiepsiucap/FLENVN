import { User } from 'src/users/user.entity';

export type SanitizedUser = Omit<
  User,
  | 'password'
  | 'emailVerificationToken'
  | 'passwordResetToken'
  | 'passwordResetExpires'
>;

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  avatar: string;
  isAdmin: boolean;
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

export interface RegisterResponse extends LoginResponse {
  emailVerificationRequired: boolean;
}
