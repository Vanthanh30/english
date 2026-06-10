export interface NoteModel {
  id: string;
  ownerId: string;
  title: string;
  contentHtml: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteInput {
  title: string;
  contentHtml: string;
  searchText: string;
}

export interface NotePageQuery {
  page: number;
  limit: number;
  search?: string;
}

export interface NotePageResult {
  items: NoteModel[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
