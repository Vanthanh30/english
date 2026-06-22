import { Injectable } from '@nestjs/common';
import { PrismaService } from '../configs/db';
import type { VisionRepository, CreateVisionHistoryInput } from './vision.repository';
import type { VisionHistoryModel, VisionWordModel } from '../models/vision.model';

@Injectable()
export class PrismaVisionRepository implements VisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createHistory(userId: string, input: CreateVisionHistoryInput): Promise<VisionHistoryModel> {
    const history = await this.prisma.visionHistory.create({
      data: {
        userId,
        imageUrl: input.imageUrl,
        imagePublicId: input.imagePublicId ?? null,
        words: {
          create: input.words.map((w) => ({
            word: w.word,
            meaning: w.meaning,
            meaningVi: w.meaningVi ?? null,
            pronunciation: w.pronunciation ?? null,
            partOfSpeech: w.partOfSpeech ?? null,
            exampleSentence: w.exampleSentence ?? null,
            saved: false,
            x: w.x ?? null,
            y: w.y ?? null,
          })),
        },
      },
      include: {
        words: true,
      },
    });

    return history as VisionHistoryModel;
  }

  async listHistory(userId: string): Promise<VisionHistoryModel[]> {
    const list = await this.prisma.visionHistory.findMany({
      where: { userId },
      include: {
        words: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return list as VisionHistoryModel[];
  }

  async findHistoryById(userId: string, id: string): Promise<VisionHistoryModel | null> {
    const history = await this.prisma.visionHistory.findFirst({
      where: { id, userId },
      include: {
        words: true,
      },
    });

    return history as VisionHistoryModel | null;
  }

  async deleteHistory(userId: string, id: string): Promise<void> {
    await this.prisma.visionHistory.deleteMany({
      where: { id, userId },
    });
  }

  async markWordsAsSaved(wordIds: string[]): Promise<void> {
    await this.prisma.visionWord.updateMany({
      where: {
        id: { in: wordIds },
      },
      data: {
        saved: true,
      },
    });
  }

  async findWordById(id: string): Promise<VisionWordModel | null> {
    const word = await this.prisma.visionWord.findUnique({
      where: { id },
    });
    return word as VisionWordModel | null;
  }

  async createWord(historyId: string, word: Omit<VisionWordModel, 'id' | 'historyId' | 'saved'>): Promise<VisionWordModel> {
    const created = await this.prisma.visionWord.create({
      data: {
        historyId,
        word: word.word,
        meaning: word.meaning,
        meaningVi: word.meaningVi ?? null,
        pronunciation: word.pronunciation ?? null,
        partOfSpeech: word.partOfSpeech ?? null,
        exampleSentence: word.exampleSentence ?? null,
        saved: false,
        x: word.x ?? null,
        y: word.y ?? null,
      },
    });
    return created as VisionWordModel;
  }
}
