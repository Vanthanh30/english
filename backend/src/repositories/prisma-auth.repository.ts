import { Injectable } from '@nestjs/common';
import { PrismaService } from '../configs/db';
import {
  AuthRepository,
  NewRefreshTokenInput,
  PendingUserInput,
} from './auth.repository';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createPendingUser(input: PendingUserInput) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        emailVerificationTokens: {
          create: {
            tokenHash: input.verificationTokenHash,
            expiresAt: input.verificationExpiresAt,
            consumedAt: null,
          },
        },
      },
    });
  }

  async refreshPendingUser(
    userId: string,
    input: Omit<PendingUserInput, 'email'>,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.emailVerificationToken.deleteMany({
        where: { userId, consumedAt: null },
      });

      return transaction.user.update({
        where: { id: userId },
        data: {
          passwordHash: input.passwordHash,
          displayName: input.displayName,
          emailVerificationTokens: {
            create: {
              tokenHash: input.verificationTokenHash,
              expiresAt: input.verificationExpiresAt,
              consumedAt: null,
            },
          },
        },
      });
    });
  }

  findVerificationToken(tokenHash: string) {
    return this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
  }

  async consumeVerificationToken(
    tokenId: string,
    userId: string,
    consumedAt: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.emailVerificationToken.updateMany({
        where: {
          id: tokenId,
          userId,
          consumedAt: null,
          expiresAt: { gt: consumedAt },
        },
        data: { consumedAt },
      });

      if (result.count !== 1) {
        return false;
      }

      await transaction.user.update({
        where: { id: userId },
        data: {
          status: 'ACTIVE',
          emailVerifiedAt: consumedAt,
        },
      });

      return true;
    });
  }

  async createRefreshToken(input: NewRefreshTokenInput): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { ...input, revokedAt: null },
    });
  }

  findRefreshToken(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  async rotateRefreshToken(
    currentTokenHash: string,
    nextToken: NewRefreshTokenInput,
    revokedAt: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.refreshToken.updateMany({
        where: {
          tokenHash: currentTokenHash,
          revokedAt: null,
          expiresAt: { gt: revokedAt },
        },
        data: { revokedAt },
      });

      if (result.count !== 1) {
        return false;
      }

      await transaction.refreshToken.create({
        data: { ...nextToken, revokedAt: null },
      });
      return true;
    });
  }

  async revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
    });
  }
}
