import type { FlashcardWithVocabulary } from '../models/flashcard.model';

export const FLASHCARD_REPOSITORY = Symbol('FLASHCARD_REPOSITORY');

export interface FlashcardRepository {
  save(userId: string, vocabularyId: string): Promise<FlashcardWithVocabulary>;
  findByUser(userId: string): Promise<FlashcardWithVocabulary[]>;
  findDue(userId: string): Promise<FlashcardWithVocabulary[]>;
  findById(userId: string, id: string): Promise<FlashcardWithVocabulary | null>;
  findByUserAndVocabulary(userId: string, vocabularyId: string): Promise<FlashcardWithVocabulary | null>;
  review(id: string, nextReviewAt: Date): Promise<FlashcardWithVocabulary>;
  makeDue(userId: string, ids: string[]): Promise<void>;
  delete(userId: string, id: string): Promise<void>;
  vocabularyExists(id: string): Promise<boolean>;

}
