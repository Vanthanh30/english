import { NotFoundException } from '@nestjs/common';
import type { FlashcardWithVocabulary } from '../models/flashcard.model';
import type { FlashcardRepository } from '../repositories/flashcard.repository';
import { FlashcardService, normalizeWrittenAnswer } from './flashcard.service';

const flashcard: FlashcardWithVocabulary = {
  id: '507f1f77bcf86cd799439011',
  userId: '507f191e810c19729de860ea',
  vocabularyId: '507f1f77bcf86cd799439012',
  nextReviewAt: new Date('2026-06-15T00:00:00.000Z'),
  lastReviewedAt: null,
  createdAt: new Date('2026-06-15T00:00:00.000Z'),
  updatedAt: new Date('2026-06-15T00:00:00.000Z'),
  vocabulary: {
    id: '507f1f77bcf86cd799439012',
    topicId: '507f1f77bcf86cd799439013',
    word: 'Check in',
    meaning: 'to register at a hotel or airport',
    meaningVi: 'làm thủ tục',
    pronunciation: null,
    partOfSpeech: 'phrasal verb',
    exampleSentence: 'We need to check in at the airport.',
    imageUrl: null,
    audioUrl: null,
  },
};

function createRepository(): jest.Mocked<FlashcardRepository> {
  return {
    save: jest.fn(),
    findByUser: jest.fn(),
    findDue: jest.fn(),
    findById: jest.fn(),
    findByUserAndVocabulary: jest.fn(),
    review: jest.fn(),
    makeDue: jest.fn(),
    delete: jest.fn(),
    vocabularyExists: jest.fn(),
  };
}

describe('FlashcardService writing practice', () => {
  let repository: jest.Mocked<FlashcardRepository>;
  let service: FlashcardService;

  beforeEach(() => {
    repository = createRepository();
    service = new FlashcardService(repository);
    repository.findById.mockResolvedValue(flashcard);
    repository.review.mockResolvedValue(flashcard);
  });

  it('normalizes case and repeated whitespace when checking spelling', () => {
    expect(normalizeWrittenAnswer('  CHECK   IN ')).toBe('check in');
    expect(normalizeWrittenAnswer('Learner’s')).toBe("learner's");
  });

  it('schedules a correct answer as easy', async () => {
    const result = await service.submitWritingPractice(
      flashcard.userId,
      flashcard.id,
      'meaning',
      ' CHECK   IN ',
    );

    expect(result).toMatchObject({
      correct: true,
      expectedAnswer: 'Check in',
      difficulty: 'easy',
    });
    expect(repository.review.mock.calls).toHaveLength(1);
    expect(repository.review.mock.calls[0][0]).toBe(flashcard.id);
    const nextReviewAt = repository.review.mock.calls[0][1];
    expect(nextReviewAt.getTime()).toBeGreaterThan(
      Date.now() + 4 * 24 * 60 * 60 * 1000,
    );
  });

  it('schedules an incorrect answer as hard', async () => {
    const result = await service.submitWritingPractice(
      flashcard.userId,
      flashcard.id,
      'listening',
      'check out',
    );

    expect(result.correct).toBe(false);
    expect(result.difficulty).toBe('hard');
    const nextReviewAt = repository.review.mock.calls[0][1];
    expect(nextReviewAt.getTime()).toBeGreaterThan(Date.now());
    expect(nextReviewAt.getTime()).toBeLessThan(
      Date.now() + 2 * 24 * 60 * 60 * 1000,
    );
  });

  it('does not reveal or grade a flashcard outside the user scope', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.submitWritingPractice(
        'another-user',
        flashcard.id,
        'meaning',
        'check in',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.review.mock.calls).toHaveLength(0);
  });
});
