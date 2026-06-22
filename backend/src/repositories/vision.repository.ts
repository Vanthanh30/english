import type { VisionHistoryModel, VisionWordModel } from '../models/vision.model';

export const VISION_REPOSITORY = 'VISION_REPOSITORY';

export interface CreateVisionHistoryInput {
  imageUrl: string;
  imagePublicId?: string;
  words: {
    word: string;
    meaning: string;
    meaningVi?: string;
    pronunciation?: string;
    partOfSpeech?: string;
    exampleSentence?: string;
    x?: number;
    y?: number;
  }[];
}

export interface VisionRepository {
  createHistory(userId: string, input: CreateVisionHistoryInput): Promise<VisionHistoryModel>;
  listHistory(userId: string): Promise<VisionHistoryModel[]>;
  findHistoryById(userId: string, id: string): Promise<VisionHistoryModel | null>;
  deleteHistory(userId: string, id: string): Promise<void>;
  markWordsAsSaved(wordIds: string[]): Promise<void>;
  findWordById(id: string): Promise<VisionWordModel | null>;
  createWord(historyId: string, word: Omit<VisionWordModel, 'id' | 'historyId' | 'saved'>): Promise<VisionWordModel>;
}
