import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  LearningLesson,
  LearningLessonSummary,
  LearningProgress,
  LearningTopic,
} from '../models/lesson.model';
import {
  LEARNING_REPOSITORY,
  type LearningLessonRecord,
  type LearningRepository,
  type UserLessonProgressRecord,
} from '../repositories/learning.repository';

@Injectable()
export class LessonService {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepository,
  ) {}

  async listTopics(userId: string): Promise<LearningTopic[]> {
    const [topics, lessons] = await Promise.all([
      this.repository.listTopics(),
      this.repository.listPublishedLessons(),
    ]);
    const lessonSummaries = await Promise.all(
      lessons.map((lesson) => this.toLessonSummary(userId, lesson)),
    );

    return topics.map((topic) => {
      const topicLessons = lessonSummaries.filter(
        (lesson) => lesson.topicId === topic.id,
      );
      return {
        ...topic,
        lessons: topicLessons,
        progress: this.aggregateProgress(
          topicLessons.map((lesson) => lesson.progress),
        ),
      };
    });
  }

  async listLessons(
    userId: string,
    topicId: string,
  ): Promise<LearningLessonSummary[]> {
    if (!(await this.repository.findActiveTopic(topicId))) {
      throw new NotFoundException('Topic not found');
    }
    const lessons = await this.repository.listPublishedLessons(topicId);
    return Promise.all(
      lessons.map((lesson) => this.toLessonSummary(userId, lesson)),
    );
  }

  async getLesson(userId: string, lessonId: string): Promise<LearningLesson> {
    const lesson = await this.getPublishedLesson(lessonId);
    const progress = await this.repository.getProgress(userId, lessonId);
    return this.toLesson(lesson, progress);
  }

  async completeVocabulary(
    userId: string,
    lessonId: string,
    vocabularyId: string,
  ): Promise<LearningLesson> {
    const lesson = await this.getPublishedLesson(lessonId);
    if (!lesson.items.some((item) => item.vocabulary.id === vocabularyId)) {
      throw new NotFoundException('Vocabulary not found in this lesson');
    }

    await this.repository.completeVocabulary(
      userId,
      lessonId,
      vocabularyId,
      new Date(),
    );
    return this.getLesson(userId, lessonId);
  }

  async completeLesson(
    userId: string,
    lessonId: string,
  ): Promise<LearningLesson> {
    const lesson = await this.getPublishedLesson(lessonId);
    const progress = await this.repository.getProgress(userId, lessonId);
    const vocabularyIds = new Set(
      lesson.items.map((item) => item.vocabulary.id),
    );
    const completedCount = progress.completedVocabularyIds.filter((id) =>
      vocabularyIds.has(id),
    ).length;

    if (!vocabularyIds.size || completedCount !== vocabularyIds.size) {
      throw new ConflictException(
        'Complete every vocabulary item before completing the lesson',
      );
    }

    if (!progress.completedAt) {
      await this.repository.completeLesson(userId, lessonId, new Date());
    }
    return this.getLesson(userId, lessonId);
  }

  private async getPublishedLesson(id: string) {
    const lesson = await this.repository.findPublishedLesson(id);
    if (!lesson) throw new NotFoundException('Published lesson not found');
    return lesson;
  }

  private async toLessonSummary(
    userId: string,
    lesson: LearningLessonRecord,
  ): Promise<LearningLessonSummary> {
    const progress = await this.repository.getProgress(userId, lesson.id);
    return {
      id: lesson.id,
      topicId: lesson.topicId,
      title: lesson.title,
      slug: lesson.slug,
      description: lesson.description,
      level: lesson.level,
      progress: this.calculateProgress(lesson, progress),
    };
  }

  private toLesson(
    lesson: LearningLessonRecord,
    stored: UserLessonProgressRecord,
  ): LearningLesson {
    const completedIds = new Set(stored.completedVocabularyIds);
    return {
      id: lesson.id,
      topicId: lesson.topicId,
      title: lesson.title,
      slug: lesson.slug,
      description: lesson.description,
      level: lesson.level,
      topic: lesson.topic,
      progress: this.calculateProgress(lesson, stored),
      vocabularies: lesson.items.map((item) => ({
        ...item.vocabulary,
        order: item.order,
        completed: completedIds.has(item.vocabulary.id),
      })),
    };
  }

  private calculateProgress(
    lesson: LearningLessonRecord,
    stored: UserLessonProgressRecord,
  ): LearningProgress {
    const lessonVocabularyIds = new Set(
      lesson.items.map((item) => item.vocabulary.id),
    );
    const completedVocabulary = stored.completedVocabularyIds.filter((id) =>
      lessonVocabularyIds.has(id),
    ).length;
    const totalVocabulary = lessonVocabularyIds.size;
    return {
      completedVocabulary,
      totalVocabulary,
      percentage: totalVocabulary
        ? Math.round((completedVocabulary / totalVocabulary) * 100)
        : 0,
      completedAt: stored.completedAt?.toISOString() ?? null,
    };
  }

  private aggregateProgress(progress: LearningProgress[]): LearningProgress {
    const completedVocabulary = progress.reduce(
      (sum, item) => sum + item.completedVocabulary,
      0,
    );
    const totalVocabulary = progress.reduce(
      (sum, item) => sum + item.totalVocabulary,
      0,
    );
    const completedDates = progress
      .map((item) => item.completedAt)
      .filter((value): value is string => Boolean(value));
    return {
      completedVocabulary,
      totalVocabulary,
      percentage: totalVocabulary
        ? Math.round((completedVocabulary / totalVocabulary) * 100)
        : 0,
      completedAt:
        progress.length > 0 && completedDates.length === progress.length
          ? (completedDates.sort().at(-1) ?? null)
          : null,
    };
  }
}
