export type SourceType = 'URL' | 'PDF' | 'DOCX' | 'TXT';
export type ReadingStatus = 'NOT_STARTED' | 'READING' | 'COMPLETED';
export type HighlightColor = 'YELLOW' | 'GREEN' | 'RED';
export type ReadingNoteType = 'VOCABULARY' | 'GRAMMAR' | 'SUMMARY' | 'PERSONAL';

export interface ReadingItemModel {
  id: string;
  userId: string;
  title: string;
  sourceType: SourceType;
  sourceUrl?: string | null;
  content: string;
  wordCount: number;
  status: ReadingStatus;
  bookmarkPosition: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VocabularyHighlightModel {
  id: string;
  readingItemId: string;
  userId: string;
  word: string;
  color: HighlightColor;
  charOffset: number;
  createdAt: Date;
}

export interface ReadingNoteModel {
  id: string;
  readingItemId: string;
  userId: string;
  noteType: ReadingNoteType;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReadingItemInput {
  title: string;
  sourceType: SourceType;
  sourceUrl?: string;
  content: string;
}

export interface CreateHighlightInput {
  word: string;
  color: HighlightColor;
  charOffset: number;
}

export interface CreateReadingNoteInput {
  noteType: ReadingNoteType;
  content: string;
}

export interface UpdateReadingNoteInput {
  content: string;
}
