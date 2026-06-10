export type { LessonInput, LessonStatus } from './course.model';

export interface LearningProgress {
  completedVocabulary: number;
  totalVocabulary: number;
  percentage: number;
  completedAt: string | null;
}

export interface LearningLessonSummary {
  id: string;
  topicId: string;
  title: string;
  slug: string;
  description: string;
  level: string;
  progress: LearningProgress;
}

export interface LearningTopic {
  id: string;
  name: string;
  slug: string;
  description: string;
  level: string;
  imageUrl: string | null;
  lessons: LearningLessonSummary[];
  progress: LearningProgress;
}

export interface LearningVocabulary {
  id: string;
  word: string;
  meaning: string;
  meaningVi: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  order: number;
  completed: boolean;
}

export interface LearningLesson extends LearningLessonSummary {
  topic: {
    id: string;
    name: string;
    slug: string;
  };
  vocabularies: LearningVocabulary[];
}
