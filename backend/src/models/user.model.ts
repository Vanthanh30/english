export type UserRole = 'STUDENT' | 'ADMIN';
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED';

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  emailVerifiedAt: string | null;
}

export interface StoredRefreshToken {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: AuthUser;
}

export interface StoredVerificationToken {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  consumedAt: Date | null;
}
