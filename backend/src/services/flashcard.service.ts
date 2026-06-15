import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  FLASHCARD_REPOSITORY,
  type FlashcardRepository,
} from '../repositories/flashcard.repository';
import type {
  FlashcardWithVocabulary,
  ReviewDifficulty,
  WritingPracticeMode,
  WritingPracticeResult,
} from '../models/flashcard.model';

export function normalizeWrittenAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ');
}

@Injectable()
export class FlashcardService {
  constructor(
    @Inject(FLASHCARD_REPOSITORY)
    private readonly repository: FlashcardRepository,
  ) {}

  async list(userId: string): Promise<FlashcardWithVocabulary[]> {
    return this.repository.findByUser(userId);
  }

  async listDue(userId: string): Promise<FlashcardWithVocabulary[]> {
    return this.repository.findDue(userId);
  }

  async save(
    userId: string,
    vocabularyId: string,
  ): Promise<FlashcardWithVocabulary> {
    const exists = await this.repository.vocabularyExists(vocabularyId);
    if (!exists) {
      throw new NotFoundException('Vocabulary not found');
    }
    const existing = await this.repository.findByUserAndVocabulary(
      userId,
      vocabularyId,
    );
    if (existing) {
      throw new ConflictException(
        'Flashcard already exists for this vocabulary',
      );
    }
    return this.repository.save(userId, vocabularyId);
  }

  async review(
    userId: string,
    id: string,
    difficulty: ReviewDifficulty,
  ): Promise<FlashcardWithVocabulary> {
    const flashcard = await this.repository.findById(userId, id);
    if (!flashcard) {
      throw new NotFoundException('Flashcard not found');
    }

    const now = new Date();
    const nextReviewAt = new Date();
    if (difficulty === 'easy') {
      nextReviewAt.setDate(now.getDate() + 5);
    } else if (difficulty === 'medium') {
      nextReviewAt.setDate(now.getDate() + 2);
    } else if (difficulty === 'hard') {
      nextReviewAt.setDate(now.getDate() + 1);
    } else {
      throw new ConflictException('Invalid review difficulty');
    }

    return this.repository.review(id, nextReviewAt);
  }

  async submitWritingPractice(
    userId: string,
    id: string,
    mode: WritingPracticeMode,
    answer: string,
  ): Promise<WritingPracticeResult> {
    const flashcard = await this.repository.findById(userId, id);
    if (!flashcard) {
      throw new NotFoundException('Flashcard not found');
    }

    const correct =
      normalizeWrittenAnswer(answer) ===
      normalizeWrittenAnswer(flashcard.vocabulary.word);
    const difficulty: ReviewDifficulty = correct ? 'easy' : 'hard';
    const reviewed = await this.review(userId, id, difficulty);

    return {
      correct,
      expectedAnswer: flashcard.vocabulary.word,
      mode,
      difficulty,
      flashcard: reviewed,
    };
  }

  async makeDue(userId: string, ids: string[]): Promise<void> {
    await this.repository.makeDue(userId, ids);
  }

  async delete(userId: string, id: string): Promise<void> {
    const flashcard = await this.repository.findById(userId, id);
    if (!flashcard) {
      throw new NotFoundException('Flashcard not found');
    }
    await this.repository.delete(userId, id);
  }
}
