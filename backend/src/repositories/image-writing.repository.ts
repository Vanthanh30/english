import type { ImageWritingSessionModel } from '../models/image-writing.model';

export const IMAGE_WRITING_REPOSITORY = 'IMAGE_WRITING_REPOSITORY';

export interface CreateImageWritingSessionInput {
  imageUrl: string;
  imagePublicId?: string | null;
  userText: string;
  overallScore: number;
  accuracyFeedback: string;
  grammarFeedback: any;
  improvedParagraph: string;
  newVocabulary: any;
  grammarPatterns: any;
}

export interface ImageWritingRepository {
  createSession(userId: string, input: CreateImageWritingSessionInput): Promise<ImageWritingSessionModel>;
  findSessionById(userId: string, id: string): Promise<ImageWritingSessionModel | null>;
  listSessions(userId: string): Promise<ImageWritingSessionModel[]>;
  updateSessionRevision(
    userId: string,
    id: string,
    revisedText: string,
    revisedScore: number,
    accuracyFeedback: string,
    grammarFeedback: any,
    improvedParagraph: string,
    newVocabulary: any,
    grammarPatterns: any,
  ): Promise<ImageWritingSessionModel>;
  deleteSession(userId: string, id: string): Promise<void>;
}
