import { Injectable } from '@nestjs/common';
import { PrismaService } from '../configs/db';
import type { LearningRepository } from './learning.repository';

@Injectable()
export class PrismaLearningRepository implements LearningRepository {
  constructor(private readonly prisma: PrismaService) {}

  listTopics() {
    return this.prisma.topic.findMany({
      where: {
        isActive: true,
        lessons: { some: { status: 'PUBLISHED' } },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        level: true,
        imageUrl: true,
      },
    });
  }

  findActiveTopic(id: string) {
    return this.prisma.topic.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        level: true,
        imageUrl: true,
      },
    });
  }

  listPublishedLessons(topicId?: string) {
    return this.prisma.lesson.findMany({
      where: {
        topicId,
        status: 'PUBLISHED',
        topic: { isActive: true },
      },
      orderBy: [{ publishedAt: 'asc' }, { createdAt: 'asc' }],
      include: this.lessonInclude,
    });
  }

  findPublishedLesson(id: string) {
    return this.prisma.lesson.findFirst({
      where: {
        id,
        status: 'PUBLISHED',
        topic: { isActive: true },
      },
      include: this.lessonInclude,
    });
  }

  async getProgress(userId: string, lessonId: string) {
    const [vocabularyProgress, lessonProgress] = await this.prisma.$transaction(
      [
        this.prisma.vocabularyProgress.findMany({
          where: { userId, lessonId },
          select: { vocabularyId: true },
        }),
        this.prisma.lessonProgress.findUnique({
          where: { userId_lessonId: { userId, lessonId } },
          select: { completedAt: true },
        }),
      ],
    );

    return {
      completedVocabularyIds: vocabularyProgress.map(
        (item: { vocabularyId: string }) => item.vocabularyId,
      ),
      completedAt: lessonProgress?.completedAt ?? null,
    };
  }

  async completeVocabulary(
    userId: string,
    lessonId: string,
    vocabularyId: string,
    completedAt: Date,
  ): Promise<void> {
    await this.prisma.vocabularyProgress.upsert({
      where: {
        userId_lessonId_vocabularyId: { userId, lessonId, vocabularyId },
      },
      create: { userId, lessonId, vocabularyId, completedAt },
      update: {},
    });
  }

  async completeLesson(
    userId: string,
    lessonId: string,
    completedAt: Date,
  ): Promise<void> {
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, completedAt },
      update: { completedAt },
    });
  }

  private readonly lessonInclude = {
    topic: { select: { id: true, name: true, slug: true } },
    items: {
      orderBy: { order: 'asc' as const },
      select: {
        order: true,
        vocabulary: {
          select: {
            id: true,
            word: true,
            meaning: true,
            meaningVi: true,
            pronunciation: true,
            partOfSpeech: true,
            exampleSentence: true,
            imageUrl: true,
            audioUrl: true,
          },
        },
      },
    },
  };
}
