import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcrypt';
import { AuthRepository } from '../repositories/auth.repository';
import { AuthUser } from '../models/user.model';
import { AuthService } from './auth.service';
import { EmailService } from './mail.service';
import { SessionGenerationService } from './session-generation.service';

const activeUser: AuthUser = {
  id: '507f1f77bcf86cd799439011',
  email: 'learner@example.com',
  passwordHash: null,
  displayName: 'Learner',
  avatarUrl: null,
  role: 'STUDENT',
  status: 'ACTIVE',
  emailVerifiedAt: new Date('2026-06-01T00:00:00.000Z'),
};

function createRepository(): jest.Mocked<AuthRepository> {
  return {
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createPendingUser: jest.fn(),
    refreshPendingUser: jest.fn(),
    findVerificationToken: jest.fn(),
    consumeVerificationToken: jest.fn(),
    createRefreshToken: jest.fn(),
    findRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
  };
}

describe('AuthService', () => {
  let repository: jest.Mocked<AuthRepository>;
  let email: jest.Mocked<Pick<EmailService, 'sendVerificationEmail'>>;
  let service: AuthService;

  beforeEach(() => {
    repository = createRepository();
    email = {
      sendVerificationEmail: jest.fn(),
    };
    const config = new ConfigService({
      JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-characters',
      JWT_REFRESH_SECRET: 'test-refresh-secret-with-at-least-32-characters',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '24h',
      EMAIL_VERIFICATION_EXPIRES_IN_HOURS: 24,
    });

    service = new AuthService(
      repository,
      new JwtService(),
      config,
      email as EmailService,
      {
        id: 'server-session-a',
        isCurrent: (id) => id === 'server-session-a',
      } as SessionGenerationService,
    );
  });

  it('hashes passwords and verification tokens during registration', async () => {
    repository.findUserByEmail.mockResolvedValue(null);
    repository.createPendingUser.mockImplementation((input) =>
      Promise.resolve({
        ...activeUser,
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        status: 'PENDING_VERIFICATION',
        emailVerifiedAt: null,
      }),
    );

    await service.register({
      email: ' Learner@Example.com ',
      displayName: 'Learner',
      password: 'Password1',
    });

    const input = repository.createPendingUser.mock.calls[0][0];
    expect(input.email).toBe('learner@example.com');
    expect(input.passwordHash).not.toBe('Password1');
    expect(input.verificationTokenHash).toHaveLength(64);
    expect(email.sendVerificationEmail).toHaveBeenCalledWith(
      'learner@example.com',
      'Learner',
      expect.any(String),
    );
  });

  it('rejects login before email verification', async () => {
    repository.findUserByEmail.mockResolvedValue({
      ...activeUser,
      passwordHash: await hash('Password1', 4),
      status: 'PENDING_VERIFICATION',
      emailVerifiedAt: null,
    });

    await expect(
      service.login('learner@example.com', 'Password1'),
    ).rejects.toThrow('Verify your email before signing in');
  });

  it('activates an account with a valid verification token', async () => {
    repository.findVerificationToken.mockResolvedValue({
      id: '507f191e810c19729de860ea',
      tokenHash: 'a'.repeat(64),
      userId: activeUser.id,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    repository.consumeVerificationToken.mockResolvedValue(true);

    await expect(service.verifyEmail('verification-token')).resolves.toEqual({
      message: 'Email verified successfully',
    });
    expect(repository.consumeVerificationToken.mock.calls[0]).toEqual([
      '507f191e810c19729de860ea',
      activeUser.id,
      expect.any(Date) as Date,
    ]);
  });

  it('stores only the refresh token hash on login', async () => {
    repository.findUserByEmail.mockResolvedValue({
      ...activeUser,
      passwordHash: await hash('Password1', 4),
    });

    const session = await service.login('learner@example.com', 'Password1');

    expect(session.accessToken).toEqual(expect.any(String));
    expect(session.refreshToken).toEqual(expect.any(String));
    const storedToken = repository.createRefreshToken.mock.calls[0]?.[0];
    expect(storedToken).toBeDefined();
    expect(storedToken?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedToken?.userId).toBe(activeUser.id);
    expect(storedToken?.tokenHash).not.toBe(session.refreshToken);
  });

  it('rotates a valid refresh token exactly once', async () => {
    repository.findUserByEmail.mockResolvedValue({
      ...activeUser,
      passwordHash: await hash('Password1', 4),
    });
    const firstSession = await service.login(
      'learner@example.com',
      'Password1',
    );
    const stored = repository.createRefreshToken.mock.calls[0][0];
    repository.findRefreshToken.mockResolvedValue({
      id: '507f191e810c19729de860ea',
      ...stored,
      revokedAt: null,
      user: activeUser,
    });
    repository.rotateRefreshToken.mockResolvedValue(true);

    const nextSession = await service.refresh(firstSession.refreshToken);

    expect(nextSession.refreshToken).not.toBe(firstSession.refreshToken);
    expect(repository.rotateRefreshToken.mock.calls[0]).toEqual([
      stored.tokenHash,
      expect.objectContaining({ userId: activeUser.id }) as typeof stored,
      expect.any(Date) as Date,
    ]);
    expect(nextSession.refreshTokenMaxAgeMs).toBeLessThanOrEqual(
      firstSession.refreshTokenMaxAgeMs,
    );
  });

  it('rejects refresh tokens issued before the current server start', async () => {
    repository.findUserByEmail.mockResolvedValue({
      ...activeUser,
      passwordHash: await hash('Password1', 4),
    });
    const previousSession = await service.login(
      'learner@example.com',
      'Password1',
    );
    const restartedService = new AuthService(
      repository,
      new JwtService(),
      new ConfigService({
        JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-characters',
        JWT_REFRESH_SECRET: 'test-refresh-secret-with-at-least-32-characters',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '24h',
      }),
      email as EmailService,
      {
        id: 'server-session-b',
        isCurrent: (id) => id === 'server-session-b',
      } as SessionGenerationService,
    );

    await expect(
      restartedService.refresh(previousSession.refreshToken),
    ).rejects.toThrow('Refresh token is invalid or expired');
  });
});
