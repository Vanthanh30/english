import type { NoteInput, NoteModel, NotePageQuery } from '../models/note.model';

export const NOTE_REPOSITORY = Symbol('NOTE_REPOSITORY');

export interface VocabularyForNote {
  id: string;
  word: string;
  meaning: string;
  meaningVi: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  topic: {
    name: string;
  };
}

export interface SavedVocabularyCard {
  id: string;
  createdAt: Date;
  note: NoteModel;
  vocabulary: VocabularyForNote;
}

export interface NoteRepository {
  list(
    ownerId: string,
    query: NotePageQuery,
  ): Promise<{ items: NoteModel[]; total: number }>;
  findById(ownerId: string, id: string): Promise<NoteModel | null>;
  create(ownerId: string, input: NoteInput): Promise<NoteModel>;
  update(ownerId: string, id: string, input: NoteInput): Promise<NoteModel>;
  delete(ownerId: string, id: string): Promise<void>;
  findSavedVocabularyNote(
    ownerId: string,
    vocabularyId: string,
  ): Promise<NoteModel | null>;
  createFromVocabulary(
    ownerId: string,
    vocabularyId: string,
    lessonId: string | undefined,
    input: NoteInput,
  ): Promise<NoteModel>;
  findVocabularyForNote(
    vocabularyId: string,
    lessonId?: string,
  ): Promise<VocabularyForNote | null>;
  listSavedVocabulary(ownerId: string): Promise<SavedVocabularyCard[]>;
}
