import { ConflictException } from '@nestjs/common';
import type { ContentRepository } from '../repositories/content.repository';
import { ContentService } from './content.service';

function createRepository(): jest.Mocked<ContentRepository> {
  return {
    listTopics: jest.fn(),
    findTopicById: jest.fn(),
    findTopicBySlug: jest.fn(),
    createTopic: jest.fn(),
    updateTopic: jest.fn(),
    countTopicContent: jest.fn(),
    deleteTopic: jest.fn(),
    listVocabularies: jest.fn(),
    findVocabularyById: jest.fn(),
    findVocabularyByWord: jest.fn(),
    createVocabulary: jest.fn(),
    updateVocabulary: jest.fn(),
    countVocabularyLessons: jest.fn(),
    deleteVocabulary: jest.fn(),
    listLessons: jest.fn(),
    findLessonById: jest.fn(),
    findLessonBySlug: jest.fn(),
    findVocabulariesByIds: jest.fn(),
    createLesson: jest.fn(),
    updateLesson: jest.fn(),
    publishLesson: jest.fn(),
    deleteLesson: jest.fn(),
  };
}

const topic = {
  id: '507f1f77bcf86cd799439011',
  name: 'Daily Life',
  slug: 'daily-life',
  description: 'Vocabulary for daily life',
  level: 'BEGINNER',
  imageUrl: null,
  imagePublicId: null,
  order: 0,
  isActive: true,
};

describe('ContentService', () => {
  let repository: jest.Mocked<ContentRepository>;
  let service: ContentService;

  beforeEach(() => {
    repository = createRepository();
    service = new ContentService(repository);
  });

  it('normalizes a generated topic slug', async () => {
    repository.findTopicBySlug.mockResolvedValue(null);
    repository.createTopic.mockResolvedValue(topic);

    await service.createTopic({
      name: 'Daily Life & Habits',
      description: 'Vocabulary for everyday situations',
      level: 'BEGINNER',
      order: 0,
      isActive: true,
    });

    expect(repository.createTopic.mock.calls[0]?.[0].slug).toBe(
      'daily-life-habits',
    );
  });

  it('prevents deleting a topic that still owns content', async () => {
    repository.findTopicById.mockResolvedValue(topic);
    repository.countTopicContent.mockResolvedValue({
      vocabularies: 2,
      lessons: 1,
    });

    await expect(service.deleteTopic(topic.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.deleteTopic.mock.calls).toHaveLength(0);
  });

  it('rejects lesson vocabulary from another topic', async () => {
    repository.findTopicById.mockResolvedValue(topic);
    repository.findVocabulariesByIds.mockResolvedValue([
      {
        id: '507f191e810c19729de860ea',
        topicId: '507f191e810c19729de860eb',
      },
    ]);

    await expect(
      service.createLesson({
        topicId: topic.id,
        title: 'Morning routine',
        description: 'Learn words for a morning routine',
        level: 'BEGINNER',
        vocabularyIds: ['507f191e810c19729de860ea'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents publishing an empty lesson', async () => {
    repository.findLessonById.mockResolvedValue({
      id: '507f191e810c19729de860ec',
      topicId: topic.id,
      title: 'Morning routine',
      slug: 'morning-routine',
      description: 'Learn words for a morning routine',
      level: 'BEGINNER',
      status: 'DRAFT',
      publishedAt: null,
      items: [],
    });

    await expect(
      service.publishLesson('507f191e810c19729de860ec'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.publishLesson.mock.calls).toHaveLength(0);
  });
});
