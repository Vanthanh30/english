import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../configs/db';
import type { ReadingRepository } from './reading.repository';
import type {
  ReadingItemModel,
  VocabularyHighlightModel,
  ReadingNoteModel,
  SourceType,
  ReadingStatus,
  HighlightColor,
  ReadingNoteType,
} from '../models/reading.model';

@Injectable()
export class PrismaReadingRepository implements ReadingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createReadingItem(
    userId: string,
    data: {
      title: string;
      sourceType: SourceType;
      sourceUrl?: string | null;
      content: string;
      wordCount: number;
    },
  ): Promise<ReadingItemModel> {
    return this.prisma.readingItem.create({
      data: {
        userId,
        title: data.title,
        sourceType: data.sourceType,
        sourceUrl: data.sourceUrl,
        content: data.content,
        wordCount: data.wordCount,
        status: 'NOT_STARTED',
        bookmarkPosition: 0.0,
      },
    }) as unknown as Promise<ReadingItemModel>;
  }

  async findReadingItemById(userId: string, id: string): Promise<ReadingItemModel | null> {
    return this.prisma.readingItem.findFirst({
      where: { id, userId },
    }) as unknown as Promise<ReadingItemModel | null>;
  }

  async findReadingItemsByUser(
    userId: string,
    filters?: {
      status?: ReadingStatus;
      sourceType?: SourceType;
      search?: string;
    },
  ): Promise<ReadingItemModel[]> {
    const where: Prisma.ReadingItemWhereInput = {
      userId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.sourceType ? { sourceType: filters.sourceType } : {}),
      ...(filters?.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { content: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.readingItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    }) as unknown as Promise<ReadingItemModel[]>;
  }

  async updateBookmark(
    userId: string,
    id: string,
    bookmarkPosition: number,
  ): Promise<ReadingItemModel> {
    return this.prisma.readingItem.update({
      where: { id, userId },
      data: { bookmarkPosition },
    }) as unknown as Promise<ReadingItemModel>;
  }

  async updateStatus(
    userId: string,
    id: string,
    status: ReadingStatus,
  ): Promise<ReadingItemModel> {
    return this.prisma.readingItem.update({
      where: { id, userId },
      data: { status },
    }) as unknown as Promise<ReadingItemModel>;
  }

  async deleteReadingItem(userId: string, id: string): Promise<void> {
    await this.prisma.readingItem.delete({
      where: { id, userId },
    });
  }

  async createHighlight(
    userId: string,
    readingItemId: string,
    data: {
      word: string;
      color: HighlightColor;
      charOffset: number;
    },
  ): Promise<VocabularyHighlightModel> {
    return this.prisma.vocabularyHighlight.create({
      data: {
        userId,
        readingItemId,
        word: data.word,
        color: data.color,
        charOffset: data.charOffset,
      },
    }) as unknown as Promise<VocabularyHighlightModel>;
  }

  async deleteHighlight(
    userId: string,
    readingItemId: string,
    highlightId: string,
  ): Promise<void> {
    await this.prisma.vocabularyHighlight.deleteMany({
      where: {
        id: highlightId,
        userId,
        readingItemId,
      },
    });
  }

  async findHighlightsByReadingItem(
    userId: string,
    readingItemId: string,
  ): Promise<VocabularyHighlightModel[]> {
    return this.prisma.vocabularyHighlight.findMany({
      where: { readingItemId, userId },
      orderBy: { charOffset: 'asc' },
    }) as unknown as Promise<VocabularyHighlightModel[]>;
  }

  async highlightExists(
    userId: string,
    readingItemId: string,
    word: string,
    charOffset: number,
  ): Promise<boolean> {
    const count = await this.prisma.vocabularyHighlight.count({
      where: {
        readingItemId,
        userId,
        word,
        charOffset,
      },
    });
    return count > 0;
  }

  async createNote(
    userId: string,
    readingItemId: string,
    data: {
      noteType: ReadingNoteType;
      content: string;
    },
  ): Promise<ReadingNoteModel> {
    return this.prisma.readingNote.create({
      data: {
        userId,
        readingItemId,
        noteType: data.noteType,
        content: data.content,
      },
    }) as unknown as Promise<ReadingNoteModel>;
  }

  async updateNote(
    userId: string,
    readingItemId: string,
    noteId: string,
    content: string,
  ): Promise<ReadingNoteModel> {
    return this.prisma.readingNote.update({
      where: { id: noteId, readingItemId, userId },
      data: { content },
    }) as unknown as Promise<ReadingNoteModel>;
  }

  async deleteNote(
    userId: string,
    readingItemId: string,
    noteId: string,
  ): Promise<void> {
    await this.prisma.readingNote.deleteMany({
      where: { id: noteId, readingItemId, userId },
    });
  }

  async findNotesByReadingItem(
    userId: string,
    readingItemId: string,
  ): Promise<ReadingNoteModel[]> {
    return this.prisma.readingNote.findMany({
      where: { readingItemId, userId },
      orderBy: { createdAt: 'desc' },
    }) as unknown as Promise<ReadingNoteModel[]>;
  }

  async findNoteById(
    userId: string,
    readingItemId: string,
    noteId: string,
  ): Promise<ReadingNoteModel | null> {
    return this.prisma.readingNote.findFirst({
      where: { id: noteId, readingItemId, userId },
    }) as unknown as Promise<ReadingNoteModel | null>;
  }
}
