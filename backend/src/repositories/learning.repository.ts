export const LEARNING_REPOSITORY = Symbol('LEARNING_REPOSITORY');

export interface LearningTopicRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  level: string;
  imageUrl: string | null;
}

export interface LearningLessonRecord {
  id: string;
  topicId: string;
  title: string;
  slug: string;
  description: string;
  level: string;
  topic: {
    id: string;
    name: string;
    slug: string;
  };
  items: Array<{
    order: number;
    vocabulary: {
      id: string;
      word: string;
      meaning: string;
      meaningVi: string | null;
      pronunciation: string | null;
      partOfSpeech: string | null;
      exampleSentence: string | null;
      imageUrl: string | null;
      audioUrl: string | null;
    };
  }>;
}

export interface UserLessonProgressRecord {
  completedVocabularyIds: string[];
  completedAt: Date | null;
}

export interface LearningRepository {
  listTopics(): Promise<LearningTopicRecord[]>;
  findActiveTopic(id: string): Promise<LearningTopicRecord | null>;
  listPublishedLessons(topicId?: string): Promise<LearningLessonRecord[]>;
  findPublishedLesson(id: string): Promise<LearningLessonRecord | null>;
  getProgress(
    userId: string,
    lessonId: string,
  ): Promise<UserLessonProgressRecord>;
  completeVocabulary(
    userId: string,
    lessonId: string,
    vocabularyId: string,
    completedAt: Date,
  ): Promise<void>;
  completeLesson(
    userId: string,
    lessonId: string,
    completedAt: Date,
  ): Promise<void>;
}
