import {
  AuthUser,
  StoredRefreshToken,
  StoredVerificationToken,
} from '../models/user.model';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface PendingUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
  verificationTokenHash: string;
  verificationExpiresAt: Date;
}

export interface NewRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  createPendingUser(input: PendingUserInput): Promise<AuthUser>;
  refreshPendingUser(
    userId: string,
    input: Omit<PendingUserInput, 'email'>,
  ): Promise<AuthUser>;
  findVerificationToken(
    tokenHash: string,
  ): Promise<StoredVerificationToken | null>;
  consumeVerificationToken(
    tokenId: string,
    userId: string,
    consumedAt: Date,
  ): Promise<boolean>;
  createRefreshToken(input: NewRefreshTokenInput): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null>;
  rotateRefreshToken(
    currentTokenHash: string,
    nextToken: NewRefreshTokenInput,
    revokedAt: Date,
  ): Promise<boolean>;
  revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void>;
}
