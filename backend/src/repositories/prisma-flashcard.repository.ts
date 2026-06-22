import { Injectable } from '@nestjs/common';
import { PrismaService } from '../configs/db';
import type { FlashcardRepository } from './flashcard.repository';
import type { FlashcardWithVocabulary } from '../models/flashcard.model';

@Injectable()
export class PrismaFlashcardRepository implements FlashcardRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get vocabularySelect() {
    return {
      select: {
        id: true,
        topicId: true,
        word: true,
        meaning: true,
        meaningVi: true,
        pronunciation: true,
        partOfSpeech: true,
        exampleSentence: true,
        imageUrl: true,
        audioUrl: true,
        topic: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    };
  }

  async save(userId: string, vocabularyId: string): Promise<FlashcardWithVocabulary> {
    return this.prisma.flashcard.upsert({
      where: {
        userId_vocabularyId: {
          userId,
          vocabularyId,
        },
      },
      update: {},
      create: {
        userId,
        vocabularyId,
      },
      include: {
        vocabulary: this.vocabularySelect,
      },
    }) as unknown as Promise<FlashcardWithVocabulary>;
  }

  async findByUser(userId: string): Promise<FlashcardWithVocabulary[]> {
    return this.prisma.flashcard.findMany({
      where: { userId },
      include: {
        vocabulary: this.vocabularySelect,
      },
      orderBy: { nextReviewAt: 'asc' },
    }) as unknown as Promise<FlashcardWithVocabulary[]>;
  }

  async findDue(userId: string): Promise<FlashcardWithVocabulary[]> {
    return this.prisma.flashcard.findMany({
      where: {
        userId,
        nextReviewAt: {
          lte: new Date(),
        },
      },
      include: {
        vocabulary: this.vocabularySelect,
      },
      orderBy: { nextReviewAt: 'asc' },
    }) as unknown as Promise<FlashcardWithVocabulary[]>;
  }

  async findById(userId: string, id: string): Promise<FlashcardWithVocabulary | null> {
    return this.prisma.flashcard.findFirst({
      where: { id, userId },
      include: {
        vocabulary: this.vocabularySelect,
      },
    }) as unknown as Promise<FlashcardWithVocabulary | null>;
  }

  async findByUserAndVocabulary(userId: string, vocabularyId: string): Promise<FlashcardWithVocabulary | null> {
    return this.prisma.flashcard.findUnique({
      where: {
        userId_vocabularyId: {
          userId,
          vocabularyId,
        },
      },
      include: {
        vocabulary: this.vocabularySelect,
      },
    }) as unknown as Promise<FlashcardWithVocabulary | null>;
  }

  async review(id: string, nextReviewAt: Date): Promise<FlashcardWithVocabulary> {
    return this.prisma.flashcard.update({
      where: { id },
      data: {
        nextReviewAt,
        lastReviewedAt: new Date(),
      },
      include: {
        vocabulary: this.vocabularySelect,
      },
    }) as unknown as Promise<FlashcardWithVocabulary>;
  }

  async makeDue(userId: string, ids: string[]): Promise<void> {
    await this.prisma.flashcard.updateMany({
      where: {
        userId,
        id: { in: ids },
      },
      data: {
        nextReviewAt: new Date(Date.now() - 60000), // 1 minute in the past
      },
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.prisma.flashcard.deleteMany({
      where: { id, userId },
    });
  }


  async vocabularyExists(id: string): Promise<boolean> {
    const count = await this.prisma.vocabulary.count({
      where: { id },
    });
    return count > 0;
  }
}
