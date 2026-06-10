import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AUTH_REPOSITORY } from '../repositories/auth.repository';
import type {
  AuthRepository,
  NewRefreshTokenInput,
} from '../repositories/auth.repository';
import type { AuthUser, PublicUser } from '../models/user.model';
import { durationToSeconds } from '../helpers/token.helper';
import { EmailService } from './mail.service';
import { SessionGenerationService } from './session-generation.service';

interface RefreshPayload {
  sub: string;
  jti: string;
  type: 'refresh';
  sid: string;
  sessionExp: number;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  refreshTokenMaxAgeMs: number;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly repository: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly sessionGeneration: SessionGenerationService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ message: string }> {
    const email = input.email.trim().toLowerCase();
    const existingUser = await this.repository.findUserByEmail(email);

    if (existingUser?.status === 'ACTIVE') {
      throw new ConflictException('An account with this email already exists');
    }

    if (existingUser?.status === 'SUSPENDED') {
      throw new ConflictException('This account is suspended');
    }

    const passwordHash = await hash(input.password, 12);
    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenHash = this.hashToken(verificationToken);
    const expirationHours = this.config.get<number>(
      'EMAIL_VERIFICATION_EXPIRES_IN_HOURS',
      24,
    );
    const verificationExpiresAt = new Date(
      Date.now() + expirationHours * 60 * 60 * 1000,
    );

    if (existingUser) {
      await this.repository.refreshPendingUser(existingUser.id, {
        passwordHash,
        displayName: input.displayName.trim(),
        verificationTokenHash,
        verificationExpiresAt,
      });
    } else {
      await this.repository.createPendingUser({
        email,
        passwordHash,
        displayName: input.displayName.trim(),
        verificationTokenHash,
        verificationExpiresAt,
      });
    }

    await this.email.sendVerificationEmail(
      email,
      input.displayName.trim(),
      verificationToken,
    );

    return {
      message:
        'Registration successful. Check your email to verify the account.',
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const storedToken = await this.repository.findVerificationToken(
      this.hashToken(token),
    );
    const now = new Date();

    if (
      !storedToken ||
      storedToken.consumedAt ||
      storedToken.expiresAt <= now
    ) {
      throw new UnauthorizedException(
        'The verification token is invalid or expired',
      );
    }

    const consumed = await this.repository.consumeVerificationToken(
      storedToken.id,
      storedToken.userId,
      now,
    );

    if (!consumed) {
      throw new UnauthorizedException(
        'The verification token is invalid or expired',
      );
    }

    return { message: 'Email verified successfully' };
  }

  async login(emailInput: string, password: string): Promise<AuthSession> {
    const user = await this.repository.findUserByEmail(
      emailInput.trim().toLowerCase(),
    );

    if (!user?.passwordHash || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Verify your email before signing in');
    }

    return this.createSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.repository.findRefreshToken(tokenHash);
    const now = new Date();

    if (
      !storedToken ||
      storedToken.userId !== payload.sub ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= now ||
      storedToken.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const nextSession = await this.buildSession(
      storedToken.user,
      payload.sessionExp,
    );
    const rotated = await this.repository.rotateRefreshToken(
      tokenHash,
      nextSession.storedRefreshToken,
      now,
    );

    if (!rotated) {
      throw new UnauthorizedException('Refresh token has already been used');
    }

    return nextSession.session;
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    await this.repository.revokeRefreshToken(
      this.hashToken(refreshToken),
      new Date(),
    );
  }

  async getUser(userId: string): Promise<PublicUser> {
    const user = await this.repository.findUserById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }
    return this.toPublicUser(user);
  }

  private async createSession(user: AuthUser): Promise<AuthSession> {
    const result = await this.buildSession(user);
    await this.repository.createRefreshToken(result.storedRefreshToken);
    return result.session;
  }

  private async buildSession(
    user: AuthUser,
    existingSessionExpiresAtSeconds?: number,
  ): Promise<{
    session: AuthSession;
    storedRefreshToken: NewRefreshTokenInput;
  }> {
    const accessExpiresIn = durationToSeconds(
      this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    );
    const sessionDuration = durationToSeconds(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '24h'),
    );
    const sessionExpiresAtSeconds =
      existingSessionExpiresAtSeconds ??
      Math.floor(Date.now() / 1000) + sessionDuration;
    const refreshExpiresIn = Math.max(
      1,
      sessionExpiresAtSeconds - Math.floor(Date.now() / 1000),
    );
    const accessTokenExpiresIn = Math.min(accessExpiresIn, refreshExpiresIn);
    const refreshToken = await this.jwt.signAsync(
      {
        sub: user.id,
        jti: randomUUID(),
        type: 'refresh',
        sid: this.sessionGeneration.id,
        sessionExp: sessionExpiresAtSeconds,
      } satisfies RefreshPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      },
    );
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
        sid: this.sessionGeneration.id,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTokenExpiresIn,
      },
    );
    const expiresAt = new Date(Date.now() + refreshExpiresIn * 1000);

    return {
      session: {
        accessToken,
        refreshToken,
        refreshTokenMaxAgeMs: refreshExpiresIn * 1000,
        user: this.toPublicUser(user),
      },
      storedRefreshToken: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      if (
        !this.sessionGeneration.isCurrent(payload.sid) ||
        payload.sessionExp <= Math.floor(Date.now() / 1000)
      ) {
        throw new Error('Session is no longer valid');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toPublicUser(user: AuthUser): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    };
  }
}
