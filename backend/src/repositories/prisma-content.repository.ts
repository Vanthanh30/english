import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../configs/db';
import type { ContentRepository } from './content.repository';
import type {
  LessonInput,
  PageQuery,
  TopicInput,
  VocabularyInput,
} from '../models/course.model';

@Injectable()
export class PrismaContentRepository implements ContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listTopics(query: PageQuery & { level?: string; isActive?: boolean }) {
    const where: Prisma.TopicWhereInput = {
      level: query.level as Prisma.EnumContentLevelFilter['equals'],
      isActive: query.isActive,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.topic.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        include: {
          _count: { select: { vocabularies: true, lessons: true } },
        },
      }),
      this.prisma.topic.count({ where }),
    ]);
    return { items, total };
  }

  findTopicById(id: string) {
    return this.prisma.topic.findUnique({ where: { id } });
  }

  findTopicBySlug(slug: string) {
    return this.prisma.topic.findUnique({ where: { slug } });
  }

  createTopic(input: TopicInput) {
    return this.prisma.topic.create({ data: input });
  }

  updateTopic(id: string, input: Partial<TopicInput>) {
    return this.prisma.topic.update({ where: { id }, data: input });
  }

  async countTopicContent(topicId: string) {
    const [vocabularies, lessons] = await this.prisma.$transaction([
      this.prisma.vocabulary.count({ where: { topicId } }),
      this.prisma.lesson.count({ where: { topicId } }),
    ]);
    return { vocabularies, lessons };
  }

  async deleteTopic(id: string): Promise<void> {
    await this.prisma.topic.delete({ where: { id } });
  }

  async listVocabularies(query: PageQuery & { topicId?: string }) {
    const where: Prisma.VocabularyWhereInput = {
      topicId: query.topicId,
      ...(query.search
        ? {
            OR: [
              { word: { contains: query.search, mode: 'insensitive' } },
              { meaning: { contains: query.search, mode: 'insensitive' } },
              { meaningVi: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.vocabulary.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { topic: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.vocabulary.count({ where }),
    ]);
    return { items, total };
  }

  findVocabularyById(id: string) {
    return this.prisma.vocabulary.findUnique({
      where: { id },
      include: { topic: true },
    });
  }

  findVocabularyByWord(topicId: string, word: string) {
    return this.prisma.vocabulary.findFirst({
      where: { topicId, word: { equals: word, mode: 'insensitive' } },
    });
  }

  createVocabulary(input: VocabularyInput) {
    return this.prisma.vocabulary.create({
      data: input,
      include: { topic: true },
    });
  }

  updateVocabulary(id: string, input: Partial<VocabularyInput>) {
    return this.prisma.vocabulary.update({
      where: { id },
      data: input,
      include: { topic: true },
    });
  }

  countVocabularyLessons(vocabularyId: string) {
    return this.prisma.lessonItem.count({ where: { vocabularyId } });
  }

  async deleteVocabulary(id: string): Promise<void> {
    await this.prisma.vocabulary.delete({ where: { id } });
  }

  async listLessons(query: PageQuery & { topicId?: string; status?: string }) {
    const where: Prisma.LessonWhereInput = {
      topicId: query.topicId,
      status: query.status as Prisma.EnumLessonStatusFilter['equals'],
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.lesson.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          topic: { select: { id: true, name: true, slug: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.lesson.count({ where }),
    ]);
    return { items, total };
  }

  findLessonById(id: string) {
    return this.prisma.lesson.findUnique({
      where: { id },
      include: {
        topic: true,
        items: {
          orderBy: { order: 'asc' },
          include: { vocabulary: true },
        },
      },
    });
  }

  findLessonBySlug(slug: string) {
    return this.prisma.lesson.findUnique({
      where: { slug },
      include: {
        items: {
          include: { vocabulary: true },
        },
      },
    });
  }

  findVocabulariesByIds(ids: string[]) {
    return this.prisma.vocabulary.findMany({
      where: { id: { in: ids } },
      select: { id: true, topicId: true },
    });
  }

  createLesson(input: LessonInput) {
    const { vocabularyIds, ...lesson } = input;
    return this.prisma.lesson.create({
      data: {
        ...lesson,
        items: {
          create: vocabularyIds.map((vocabularyId, order) => ({
            vocabularyId,
            order,
          })),
        },
      },
      include: {
        topic: true,
        items: { orderBy: { order: 'asc' }, include: { vocabulary: true } },
      },
    });
  }

  updateLesson(id: string, input: Partial<LessonInput>) {
    const { vocabularyIds, ...lesson } = input;
    return this.prisma.$transaction(async (transaction) => {
      if (vocabularyIds) {
        await transaction.lessonItem.deleteMany({ where: { lessonId: id } });
      }

      return transaction.lesson.update({
        where: { id },
        data: {
          ...lesson,
          ...(vocabularyIds
            ? {
                items: {
                  create: vocabularyIds.map((vocabularyId, order) => ({
                    vocabularyId,
                    order,
                  })),
                },
              }
            : {}),
        },
        include: {
          topic: true,
          items: {
            orderBy: { order: 'asc' },
            include: { vocabulary: true },
          },
        },
      });
    });
  }

  publishLesson(id: string, publishedAt: Date) {
    return this.prisma.lesson.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt },
      include: {
        topic: true,
        items: { orderBy: { order: 'asc' }, include: { vocabulary: true } },
      },
    });
  }

  async deleteLesson(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.lessonItem.deleteMany({ where: { lessonId: id } }),
      this.prisma.lesson.delete({ where: { id } }),
    ]);
  }
}
