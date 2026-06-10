export type ContentLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type LessonStatus = 'DRAFT' | 'PUBLISHED';

export interface PageQuery {
  page: number;
  limit: number;
  search?: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TopicInput {
  name: string;
  slug: string;
  description: string;
  level: ContentLevel;
  imageUrl?: string;
  imagePublicId?: string;
  order: number;
  isActive: boolean;
}

export interface VocabularyInput {
  topicId: string;
  word: string;
  meaning: string;
  meaningVi: string;
  pronunciation?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  imageUrl?: string;
  imagePublicId?: string;
  audioUrl?: string;
}

export interface LessonInput {
  topicId: string;
  title: string;
  slug: string;
  description: string;
  level: ContentLevel;
  vocabularyIds: string[];
}
