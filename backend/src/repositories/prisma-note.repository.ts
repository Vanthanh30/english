import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../configs/db';
import type { NoteRepository } from './note.repository';
import type { NoteInput, NotePageQuery } from '../models/note.model';

@Injectable()
export class PrismaNoteRepository implements NoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string, query: NotePageQuery) {
    const where: Prisma.NoteWhereInput = {
      ownerId,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { searchText: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.note.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.note.count({ where }),
    ]);
    return { items, total };
  }

  findById(ownerId: string, id: string) {
    return this.prisma.note.findFirst({ where: { id, ownerId } });
  }

  create(ownerId: string, input: NoteInput) {
    return this.prisma.note.create({ data: { ownerId, ...input } });
  }

  update(ownerId: string, id: string, input: NoteInput) {
    return this.prisma.note.update({ where: { id, ownerId }, data: input });
  }

  async delete(ownerId: string, id: string): Promise<void> {
    await this.prisma.note.delete({ where: { id, ownerId } });
  }

  async findSavedVocabularyNote(ownerId: string, vocabularyId: string) {
    const saved = await this.prisma.savedVocabularyNote.findUnique({
      where: { ownerId_vocabularyId: { ownerId, vocabularyId } },
      include: { note: true },
    });
    return saved?.note ?? null;
  }

  createFromVocabulary(
    ownerId: string,
    vocabularyId: string,
    lessonId: string | undefined,
    input: NoteInput,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const note = await transaction.note.create({
        data: { ownerId, ...input },
      });
      await transaction.savedVocabularyNote.create({
        data: { ownerId, vocabularyId, lessonId, noteId: note.id },
      });
      return note;
    });
  }

  findVocabularyForNote(vocabularyId: string, lessonId?: string) {
    return this.prisma.vocabulary.findFirst({
      where: {
        id: vocabularyId,
        ...(lessonId
          ? {
              lessonItems: {
                some: {
                  lessonId,
                  lesson: { status: 'PUBLISHED' },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        word: true,
        meaning: true,
        meaningVi: true,
        pronunciation: true,
        partOfSpeech: true,
        exampleSentence: true,
        topic: { select: { name: true } },
      },
    });
  }

  listSavedVocabulary(ownerId: string) {
    return this.prisma.savedVocabularyNote.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        note: true,
        vocabulary: {
          select: {
            id: true,
            word: true,
            meaning: true,
            meaningVi: true,
            pronunciation: true,
            partOfSpeech: true,
            exampleSentence: true,
            topic: { select: { name: true } },
          },
        },
      },
    });
  }
}
