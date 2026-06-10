import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CONTENT_REPOSITORY,
  type ContentRepository,
} from '../repositories/content.repository';
import type {
  LessonInput,
  PageQuery,
  PageResult,
  TopicInput,
  VocabularyInput,
} from '../models/course.model';

@Injectable()
export class ContentService {
  constructor(
    @Inject(CONTENT_REPOSITORY)
    private readonly repository: ContentRepository,
  ) {}

  async listTopics(query: PageQuery & { level?: string; isActive?: boolean }) {
    return this.toPage(await this.repository.listTopics(query), query);
  }

  async getTopic(id: string) {
    const topic = await this.repository.findTopicById(id);
    if (!topic) throw new NotFoundException('Topic not found');
    return topic;
  }

  async createTopic(input: Omit<TopicInput, 'slug'> & { slug?: string }) {
    const slug = this.slugify(input.slug || input.name);
    if (await this.repository.findTopicBySlug(slug)) {
      throw new ConflictException('Topic slug already exists');
    }
    return this.repository.createTopic({ ...input, slug });
  }

  async updateTopic(
    id: string,
    input: Partial<Omit<TopicInput, 'slug'>> & { slug?: string },
  ) {
    await this.getTopic(id);
    const slug = input.slug ? this.slugify(input.slug) : undefined;
    if (slug) {
      const duplicate = await this.repository.findTopicBySlug(slug);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Topic slug already exists');
      }
    }
    return this.repository.updateTopic(id, { ...input, slug });
  }

  async deleteTopic(id: string): Promise<void> {
    await this.getTopic(id);
    const count = await this.repository.countTopicContent(id);
    if (count.vocabularies || count.lessons) {
      throw new ConflictException(
        'Remove the topic vocabularies and lessons before deleting it',
      );
    }
    await this.repository.deleteTopic(id);
  }

  async listVocabularies(query: PageQuery & { topicId?: string }) {
    return this.toPage(await this.repository.listVocabularies(query), query);
  }

  async getVocabulary(id: string) {
    const vocabulary = await this.repository.findVocabularyById(id);
    if (!vocabulary) throw new NotFoundException('Vocabulary not found');
    return vocabulary;
  }

  async createVocabulary(input: VocabularyInput) {
    await this.getTopic(input.topicId);
    const word = input.word.trim();
    if (await this.repository.findVocabularyByWord(input.topicId, word)) {
      throw new ConflictException('This word already exists in the topic');
    }
    return this.repository.createVocabulary({ ...input, word });
  }

  async updateVocabulary(id: string, input: Partial<VocabularyInput>) {
    const current = await this.getVocabulary(id);
    const topicId = input.topicId ?? current.topicId;
    const word = input.word?.trim() ?? current.word;
    await this.getTopic(topicId);
    const duplicate = await this.repository.findVocabularyByWord(topicId, word);
    if (duplicate && duplicate.id !== id) {
      throw new ConflictException('This word already exists in the topic');
    }
    return this.repository.updateVocabulary(id, { ...input, word, topicId });
  }

  async deleteVocabulary(id: string): Promise<void> {
    await this.getVocabulary(id);
    if (await this.repository.countVocabularyLessons(id)) {
      throw new ConflictException(
        'Remove this vocabulary from lessons before deleting it',
      );
    }
    await this.repository.deleteVocabulary(id);
  }

  async listLessons(query: PageQuery & { topicId?: string; status?: string }) {
    return this.toPage(await this.repository.listLessons(query), query);
  }

  async getLesson(id: string) {
    const lesson = await this.repository.findLessonById(id);
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async createLesson(input: Omit<LessonInput, 'slug'> & { slug?: string }) {
    await this.validateLessonItems(input.topicId, input.vocabularyIds);
    const slug = this.slugify(input.slug || input.title);
    if (await this.repository.findLessonBySlug(slug)) {
      throw new ConflictException('Lesson slug already exists');
    }
    return this.repository.createLesson({ ...input, slug });
  }

  async updateLesson(
    id: string,
    input: Partial<Omit<LessonInput, 'slug'>> & { slug?: string },
  ) {
    const current = await this.getLesson(id);
    const topicId = input.topicId ?? current.topicId;
    if (input.topicId || input.vocabularyIds) {
      const vocabularyIds =
        input.vocabularyIds ?? current.items.map((item) => item.vocabulary.id);
      await this.validateLessonItems(topicId, vocabularyIds);
    }
    const slug = input.slug ? this.slugify(input.slug) : undefined;
    if (slug) {
      const duplicate = await this.repository.findLessonBySlug(slug);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Lesson slug already exists');
      }
    }
    return this.repository.updateLesson(id, { ...input, slug });
  }

  async publishLesson(id: string) {
    const lesson = await this.getLesson(id);
    if (!lesson.items.length) {
      throw new ConflictException(
        'A lesson must contain vocabulary before publishing',
      );
    }
    if (
      lesson.items.some((item) => item.vocabulary.topicId !== lesson.topicId)
    ) {
      throw new ConflictException(
        'Every lesson vocabulary must belong to the lesson topic',
      );
    }
    return this.repository.publishLesson(id, new Date());
  }

  async deleteLesson(id: string): Promise<void> {
    await this.getLesson(id);
    await this.repository.deleteLesson(id);
  }

  private async validateLessonItems(
    topicId: string,
    vocabularyIds: string[],
  ): Promise<void> {
    await this.getTopic(topicId);
    if (new Set(vocabularyIds).size !== vocabularyIds.length) {
      throw new ConflictException(
        'Lesson vocabulary cannot contain duplicates',
      );
    }
    const vocabularies =
      await this.repository.findVocabulariesByIds(vocabularyIds);
    if (
      vocabularies.length !== vocabularyIds.length ||
      vocabularies.some((vocabulary) => vocabulary.topicId !== topicId)
    ) {
      throw new ConflictException(
        'Every lesson vocabulary must belong to the selected topic',
      );
    }
  }

  private toPage<T>(
    result: { items: T[]; total: number },
    query: PageQuery,
  ): PageResult<T> {
    return {
      ...result,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(result.total / query.limit),
    };
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
