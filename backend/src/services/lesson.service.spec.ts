import { ConflictException } from '@nestjs/common';
import { LessonService } from './lesson.service';
import type {
  LearningLessonRecord,
  LearningRepository,
  LearningTopicRecord,
  UserLessonProgressRecord,
} from '../repositories/learning.repository';

class InMemoryLearningRepository implements LearningRepository {
  readonly topics: LearningTopicRecord[] = [
    {
      id: 'topic-1',
      name: 'Travel',
      slug: 'travel',
      description: 'Travel vocabulary',
      level: 'BEGINNER',
      imageUrl: null,
    },
  ];
  readonly lessons: LearningLessonRecord[] = [
    {
      id: 'lesson-1',
      topicId: 'topic-1',
      title: 'At the airport',
      slug: 'at-the-airport',
      description: 'Airport vocabulary',
      level: 'BEGINNER',
      topic: { id: 'topic-1', name: 'Travel', slug: 'travel' },
      items: [
        {
          order: 0,
          vocabulary: {
            id: 'word-1',
            word: 'passport',
            meaning: 'an official travel document',
            meaningVi: 'hộ chiếu',
            pronunciation: null,
            partOfSpeech: 'noun',
            exampleSentence: 'Please show your passport.',
            imageUrl: null,
            audioUrl: null,
          },
        },
        {
          order: 1,
          vocabulary: {
            id: 'word-2',
            word: 'departure',
            meaning: 'the act of leaving',
            meaningVi: 'sự khởi hành',
            pronunciation: null,
            partOfSpeech: 'noun',
            exampleSentence: 'Check the departure time.',
            imageUrl: null,
            audioUrl: null,
          },
        },
      ],
    },
  ];
  private readonly vocabularyProgress = new Map<string, Set<string>>();
  private readonly lessonProgress = new Map<string, Date>();

  listTopics() {
    return Promise.resolve(this.topics);
  }

  findActiveTopic(id: string) {
    return Promise.resolve(
      this.topics.find((topic) => topic.id === id) ?? null,
    );
  }

  listPublishedLessons(topicId?: string) {
    return Promise.resolve(
      topicId
        ? this.lessons.filter((lesson) => lesson.topicId === topicId)
        : this.lessons,
    );
  }

  findPublishedLesson(id: string) {
    return Promise.resolve(
      this.lessons.find((lesson) => lesson.id === id) ?? null,
    );
  }

  getProgress(
    userId: string,
    lessonId: string,
  ): Promise<UserLessonProgressRecord> {
    const key = `${userId}:${lessonId}`;
    return Promise.resolve({
      completedVocabularyIds: [...(this.vocabularyProgress.get(key) ?? [])],
      completedAt: this.lessonProgress.get(key) ?? null,
    });
  }

  completeVocabulary(userId: string, lessonId: string, vocabularyId: string) {
    const key = `${userId}:${lessonId}`;
    const completed = this.vocabularyProgress.get(key) ?? new Set<string>();
    completed.add(vocabularyId);
    this.vocabularyProgress.set(key, completed);
    return Promise.resolve();
  }

  completeLesson(userId: string, lessonId: string, completedAt: Date) {
    this.lessonProgress.set(`${userId}:${lessonId}`, completedAt);
    return Promise.resolve();
  }
}

describe('LessonService', () => {
  let repository: InMemoryLearningRepository;
  let service: LessonService;

  beforeEach(() => {
    repository = new InMemoryLearningRepository();
    service = new LessonService(repository);
  });

  it('keeps vocabulary progress isolated by user', async () => {
    await service.completeVocabulary('user-1', 'lesson-1', 'word-1');

    const firstUser = await service.getLesson('user-1', 'lesson-1');
    const secondUser = await service.getLesson('user-2', 'lesson-1');

    expect(firstUser.progress.percentage).toBe(50);
    expect(secondUser.progress.percentage).toBe(0);
  });

  it('keeps completion percentages stable after repeated requests', async () => {
    await service.completeVocabulary('user-1', 'lesson-1', 'word-1');
    const result = await service.completeVocabulary(
      'user-1',
      'lesson-1',
      'word-1',
    );

    expect(result.progress).toMatchObject({
      completedVocabulary: 1,
      totalVocabulary: 2,
      percentage: 50,
    });
  });

  it('requires every vocabulary item before completing a lesson', async () => {
    await service.completeVocabulary('user-1', 'lesson-1', 'word-1');

    await expect(service.completeLesson('user-1', 'lesson-1')).rejects.toThrow(
      ConflictException,
    );

    await service.completeVocabulary('user-1', 'lesson-1', 'word-2');
    const completed = await service.completeLesson('user-1', 'lesson-1');
    const repeated = await service.completeLesson('user-1', 'lesson-1');

    expect(completed.progress.completedAt).not.toBeNull();
    expect(repeated.progress.completedAt).toBe(completed.progress.completedAt);
  });
});
