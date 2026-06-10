import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  NOTE_REPOSITORY,
  type NoteRepository,
} from '../repositories/note.repository';
import type {
  NoteInput,
  NotePageQuery,
  NotePageResult,
} from '../models/note.model';
import {
  noteSearchText,
  sanitizeNoteHtml,
} from '../helpers/note-sanitizer.helper';

@Injectable()
export class NoteService {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly repository: NoteRepository,
  ) {}

  async list(ownerId: string, query: NotePageQuery): Promise<NotePageResult> {
    const normalizedQuery = {
      ...query,
      search: query.search?.trim() || undefined,
    };
    const result = await this.repository.list(ownerId, normalizedQuery);
    return {
      ...result,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(result.total / query.limit),
    };
  }

  async get(ownerId: string, id: string) {
    const note = await this.repository.findById(ownerId, id);
    if (!note) throw new NotFoundException('Note not found');
    return note;
  }

  create(ownerId: string, input: { title: string; contentHtml: string }) {
    return this.repository.create(ownerId, this.prepareInput(input));
  }

  async update(
    ownerId: string,
    id: string,
    input: { title: string; contentHtml: string },
  ) {
    await this.get(ownerId, id);
    return this.repository.update(ownerId, id, this.prepareInput(input));
  }

  async delete(ownerId: string, id: string): Promise<void> {
    await this.get(ownerId, id);
    await this.repository.delete(ownerId, id);
  }

  async getVocabularyNote(ownerId: string, vocabularyId: string) {
    const note = await this.repository.findSavedVocabularyNote(
      ownerId,
      vocabularyId,
    );
    return { saved: Boolean(note), note };
  }

  listSavedVocabulary(ownerId: string) {
    return this.repository.listSavedVocabulary(ownerId);
  }

  async saveVocabulary(
    ownerId: string,
    vocabularyId: string,
    lessonId?: string,
  ) {
    const existing = await this.repository.findSavedVocabularyNote(
      ownerId,
      vocabularyId,
    );
    if (existing) {
      return { saved: true, created: false, note: existing };
    }

    const vocabulary = await this.repository.findVocabularyForNote(
      vocabularyId,
      lessonId,
    );
    if (!vocabulary) {
      throw new NotFoundException('Vocabulary not found in this lesson');
    }

    const title = `${vocabulary.word} - Vocabulary note`;
    const details = [
      vocabulary.pronunciation
        ? `<p><strong>Pronunciation:</strong> ${this.escapeHtml(vocabulary.pronunciation)}</p>`
        : '',
      vocabulary.partOfSpeech
        ? `<p><strong>Part of speech:</strong> ${this.escapeHtml(vocabulary.partOfSpeech)}</p>`
        : '',
      vocabulary.meaningVi
        ? `<h2>Vietnamese meaning</h2><p>${this.escapeHtml(vocabulary.meaningVi)}</p>`
        : '',
      `<h2>English definition</h2><p>${this.escapeHtml(vocabulary.meaning)}</p>`,
      vocabulary.exampleSentence
        ? `<h2>Example</h2><blockquote>${this.escapeHtml(vocabulary.exampleSentence)}</blockquote>`
        : '',
      `<p><strong>Topic:</strong> ${this.escapeHtml(vocabulary.topic.name)}</p>`,
      '<h2>My notes</h2><p><br></p>',
    ].join('');
    const input = this.prepareInput({ title, contentHtml: details });
    const note = await this.repository.createFromVocabulary(
      ownerId,
      vocabularyId,
      lessonId,
      input,
    );
    return { saved: true, created: true, note };
  }

  private prepareInput(input: {
    title: string;
    contentHtml: string;
  }): NoteInput {
    const title = input.title.trim();
    const contentHtml = sanitizeNoteHtml(input.contentHtml);
    return {
      title,
      contentHtml,
      searchText: noteSearchText(title, contentHtml),
    };
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
