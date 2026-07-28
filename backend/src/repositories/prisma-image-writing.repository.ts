import { Injectable } from '@nestjs/common';
import { PrismaService } from '../configs/db';
import type { ImageWritingRepository, CreateImageWritingSessionInput } from './image-writing.repository';
import type { ImageWritingSessionModel } from '../models/image-writing.model';

@Injectable()
export class PrismaImageWritingRepository implements ImageWritingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string, input: CreateImageWritingSessionInput): Promise<ImageWritingSessionModel> {
    const session = await this.prisma.imageWritingSession.create({
      data: {
        userId,
        imageUrl: input.imageUrl,
        imagePublicId: input.imagePublicId ?? null,
        userText: input.userText,
        overallScore: input.overallScore,
        accuracyFeedback: input.accuracyFeedback,
        grammarFeedback: input.grammarFeedback,
        improvedParagraph: input.improvedParagraph,
        newVocabulary: input.newVocabulary,
        grammarPatterns: input.grammarPatterns,
      },
    });

    return session as unknown as ImageWritingSessionModel;
  }

  async findSessionById(userId: string, id: string): Promise<ImageWritingSessionModel | null> {
    const session = await this.prisma.imageWritingSession.findFirst({
      where: { id, userId },
    });

    if (!session) return null;
    return session as unknown as ImageWritingSessionModel;
  }

  async listSessions(userId: string): Promise<ImageWritingSessionModel[]> {
    const list = await this.prisma.imageWritingSession.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return list as unknown as ImageWritingSessionModel[];
  }

  async updateSessionRevision(
    userId: string,
    id: string,
    revisedText: string,
    revisedScore: number,
    accuracyFeedback: string,
    grammarFeedback: any,
    improvedParagraph: string,
    newVocabulary: any,
    grammarPatterns: any,
  ): Promise<ImageWritingSessionModel> {
    const session = await this.prisma.imageWritingSession.update({
      where: { id, userId },
      data: {
        revisedText,
        revisedScore,
        accuracyFeedback,
        grammarFeedback,
        improvedParagraph,
        newVocabulary,
        grammarPatterns,
      },
    });

    return session as unknown as ImageWritingSessionModel;
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    await this.prisma.imageWritingSession.deleteMany({
      where: { id, userId },
    });
  }
}
