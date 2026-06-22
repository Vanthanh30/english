import { API_URL } from "./api";
import { authApi } from "./auth.service";
import { useAuthStore } from "@/stores/auth.store";

export type SourceType = 'URL' | 'PDF' | 'DOCX' | 'TXT';
export type ReadingStatus = 'NOT_STARTED' | 'READING' | 'COMPLETED';
export type HighlightColor = 'YELLOW' | 'GREEN' | 'RED';
export type ReadingNoteType = 'VOCABULARY' | 'GRAMMAR' | 'SUMMARY' | 'PERSONAL';

export interface ReadingItem {
  id: string;
  userId: string;
  title: string;
  sourceType: SourceType;
  sourceUrl?: string | null;
  content: string;
  wordCount: number;
  status: ReadingStatus;
  bookmarkPosition: number;
  createdAt: string;
  updatedAt: string;
}

export interface VocabularyHighlight {
  id: string;
  readingItemId: string;
  userId: string;
  word: string;
  color: HighlightColor;
  charOffset: number;
  createdAt: string;
}

export interface ReadingNote {
  id: string;
  readingItemId: string;
  userId: string;
  noteType: ReadingNoteType;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface DictionaryEntry {
  word: string;
  meaningVi: string;
  meaning: string;
  pronunciation: string;
  partOfSpeech: string;
  exampleSentence: string;
  audioUrl: string;
  vocabularyId: string | null;
  isLocal: boolean;
  isPhrase: boolean;
}

async function getAccessToken(): Promise<string> {
  const state = useAuthStore.getState();
  if (state.accessToken) return state.accessToken;
  const session = await authApi.refresh();
  state.setSession(session);
  return session.accessToken;
}

async function readingRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (options.headers) {
    const optHeaders = options.headers as any;
    for (const key in optHeaders) {
      headers[key] = optHeaders[key];
    }
  }

  // Do not set Content-Type header if sending FormData (Multipart)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: headers as any,
  });

  if (response.status === 401 && retry) {
    try {
      const session = await authApi.refresh();
      useAuthStore.getState().setSession(session);
      return readingRequest<T>(path, options, false);
    } catch (error) {
      useAuthStore.getState().clearSession();
      throw error;
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(". ")
      : body?.message;
    throw new Error(message ?? "Request failed");
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const readingApi = {
  list(params: { status?: ReadingStatus; sourceType?: SourceType; search?: string } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.sourceType) query.set("sourceType", params.sourceType);
    if (params.search?.trim()) query.set("search", params.search.trim());
    return readingRequest<ReadingItem[]>(`/reading?${query.toString()}`);
  },

  get(id: string) {
    return readingRequest<ReadingItem>(`/reading/${id}`);
  },

  importUrl(url: string) {
    return readingRequest<ReadingItem>("/reading/import-url", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  },

  uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return readingRequest<ReadingItem>("/reading/upload", {
      method: "POST",
      body: formData,
    });
  },

  delete(id: string) {
    return readingRequest<void>(`/reading/${id}`, {
      method: "DELETE",
    });
  },

  updateBookmark(id: string, bookmarkPosition: number) {
    return readingRequest<ReadingItem>(`/reading/${id}/bookmark`, {
      method: "PATCH",
      body: JSON.stringify({ bookmarkPosition }),
    });
  },

  updateStatus(id: string, status: ReadingStatus) {
    return readingRequest<ReadingItem>(`/reading/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  // Highlights
  listHighlights(id: string) {
    return readingRequest<VocabularyHighlight[]>(`/reading/${id}/highlights`);
  },

  addHighlight(id: string, input: { word: string; color: HighlightColor; charOffset: number }) {
    return readingRequest<VocabularyHighlight>(`/reading/${id}/highlights`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  removeHighlight(id: string, highlightId: string) {
    return readingRequest<void>(`/reading/${id}/highlights/${highlightId}`, {
      method: "DELETE",
    });
  },

  // Notes
  listNotes(id: string) {
    return readingRequest<ReadingNote[]>(`/reading/${id}/notes`);
  },

  createNote(id: string, input: { noteType: ReadingNoteType; content: string }) {
    return readingRequest<ReadingNote>(`/reading/${id}/notes`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateNote(id: string, noteId: string, content: string) {
    return readingRequest<ReadingNote>(`/reading/${id}/notes/${noteId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });
  },

  deleteNote(id: string, noteId: string) {
    return readingRequest<void>(`/reading/${id}/notes/${noteId}`, {
      method: "DELETE",
    });
  },

  // Dictionary Lookup
  lookupWord(word: string) {
    return readingRequest<DictionaryEntry>(`/dictionary/lookup?word=${encodeURIComponent(word)}`);
  },

  saveToFlashcard(wordInfo: {
    word: string;
    meaning: string;
    meaningVi?: string;
    pronunciation?: string;
    partOfSpeech?: string;
    exampleSentence?: string;
  }) {
    return readingRequest<{ success: boolean; alreadySaved: boolean; flashcard: any }>("/dictionary/flashcard", {
      method: "POST",
      body: JSON.stringify(wordInfo),
    });
  },
};
