import type {
  ReadingItemModel,
  VocabularyHighlightModel,
  ReadingNoteModel,
  SourceType,
  ReadingStatus,
  HighlightColor,
  ReadingNoteType,
} from '../models/reading.model';

export const READING_REPOSITORY = Symbol('READING_REPOSITORY');

export interface ReadingRepository {
  createReadingItem(
    userId: string,
    data: {
      title: string;
      sourceType: SourceType;
      sourceUrl?: string | null;
      content: string;
      wordCount: number;
    },
  ): Promise<ReadingItemModel>;

  findReadingItemById(userId: string, id: string): Promise<ReadingItemModel | null>;

  findReadingItemsByUser(
    userId: string,
    filters?: {
      status?: ReadingStatus;
      sourceType?: SourceType;
      search?: string;
    },
  ): Promise<ReadingItemModel[]>;

  updateBookmark(
    userId: string,
    id: string,
    bookmarkPosition: number,
  ): Promise<ReadingItemModel>;

  updateStatus(
    userId: string,
    id: string,
    status: ReadingStatus,
  ): Promise<ReadingItemModel>;

  deleteReadingItem(userId: string, id: string): Promise<void>;

  createHighlight(
    userId: string,
    readingItemId: string,
    data: {
      word: string;
      color: HighlightColor;
      charOffset: number;
    },
  ): Promise<VocabularyHighlightModel>;

  deleteHighlight(
    userId: string,
    readingItemId: string,
    highlightId: string,
  ): Promise<void>;

  findHighlightsByReadingItem(
    userId: string,
    readingItemId: string,
  ): Promise<VocabularyHighlightModel[]>;

  highlightExists(
    userId: string,
    readingItemId: string,
    word: string,
    charOffset: number,
  ): Promise<boolean>;

  createNote(
    userId: string,
    readingItemId: string,
    data: {
      noteType: ReadingNoteType;
      content: string;
    },
  ): Promise<ReadingNoteModel>;

  updateNote(
    userId: string,
    readingItemId: string,
    noteId: string,
    content: string,
  ): Promise<ReadingNoteModel>;

  deleteNote(userId: string, readingItemId: string, noteId: string): Promise<void>;

  findNotesByReadingItem(
    userId: string,
    readingItemId: string,
  ): Promise<ReadingNoteModel[]>;

  findNoteById(
    userId: string,
    readingItemId: string,
    noteId: string,
  ): Promise<ReadingNoteModel | null>;
}
