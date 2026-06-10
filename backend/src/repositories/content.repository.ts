import type {
  LessonInput,
  PageQuery,
  TopicInput,
  VocabularyInput,
} from '../models/course.model';

export const CONTENT_REPOSITORY = Symbol('CONTENT_REPOSITORY');

export interface TopicRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  level: string;
  imageUrl: string | null;
  imagePublicId: string | null;
  order: number;
  isActive: boolean;
}

export interface VocabularyRecord {
  id: string;
  topicId: string;
  word: string;
  meaning: string;
  meaningVi: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  audioUrl: string | null;
}

export interface LessonRecord {
  id: string;
  topicId: string;
  title: string;
  slug: string;
  description: string;
  level: string;
  status: string;
  publishedAt: Date | null;
  items: Array<{
    order: number;
    vocabulary: VocabularyRecord;
  }>;
}

export interface ContentRepository {
  listTopics(
    query: PageQuery & { level?: string; isActive?: boolean },
  ): Promise<{ items: unknown[]; total: number }>;
  findTopicById(id: string): Promise<TopicRecord | null>;
  findTopicBySlug(slug: string): Promise<TopicRecord | null>;
  createTopic(input: TopicInput): Promise<unknown>;
  updateTopic(id: string, input: Partial<TopicInput>): Promise<unknown>;
  countTopicContent(
    topicId: string,
  ): Promise<{ vocabularies: number; lessons: number }>;
  deleteTopic(id: string): Promise<void>;

  listVocabularies(
    query: PageQuery & { topicId?: string },
  ): Promise<{ items: unknown[]; total: number }>;
  findVocabularyById(id: string): Promise<VocabularyRecord | null>;
  findVocabularyByWord(
    topicId: string,
    word: string,
  ): Promise<VocabularyRecord | null>;
  createVocabulary(input: VocabularyInput): Promise<unknown>;
  updateVocabulary(
    id: string,
    input: Partial<VocabularyInput>,
  ): Promise<unknown>;
  countVocabularyLessons(vocabularyId: string): Promise<number>;
  deleteVocabulary(id: string): Promise<void>;

  listLessons(
    query: PageQuery & { topicId?: string; status?: string },
  ): Promise<{ items: unknown[]; total: number }>;
  findLessonById(id: string): Promise<LessonRecord | null>;
  findLessonBySlug(slug: string): Promise<LessonRecord | null>;
  findVocabulariesByIds(
    ids: string[],
  ): Promise<Array<{ id: string; topicId: string }>>;
  createLesson(input: LessonInput): Promise<unknown>;
  updateLesson(id: string, input: Partial<LessonInput>): Promise<unknown>;
  publishLesson(id: string, publishedAt: Date): Promise<unknown>;
  deleteLesson(id: string): Promise<void>;
}
