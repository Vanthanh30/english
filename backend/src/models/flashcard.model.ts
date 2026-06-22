export interface TopicModel {
  id: string;
  name: string;
  slug: string;
}

export interface VocabularyModel {
  id: string;
  topicId: string;
  word: string;
  meaning: string;
  meaningVi: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  topic?: TopicModel | null;
}

export interface FlashcardModel {
  id: string;
  userId: string;
  vocabularyId: string;
  nextReviewAt: Date;
  lastReviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlashcardWithVocabulary extends FlashcardModel {
  vocabulary: VocabularyModel;
}

export type ReviewDifficulty = 'easy' | 'medium' | 'hard';

export type WritingPracticeMode = 'listening' | 'meaning';

export interface WritingPracticeResult {
  correct: boolean;
  expectedAnswer: string;
  mode: WritingPracticeMode;
  difficulty: ReviewDifficulty;
  flashcard: FlashcardWithVocabulary;
}
