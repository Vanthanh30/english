import { API_URL } from "./api";
import { authApi } from "./auth.service";
import { useAuthStore } from "@/stores/auth.store";

export interface Note {
  id: string;
  ownerId: string;
  title: string;
  contentHtml: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotePage {
  items: Note[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NoteInput {
  title: string;
  contentHtml: string;
}

export interface VocabularyNoteStatus {
  saved: boolean;
  created?: boolean;
  note: Note | null;
}

export interface SavedVocabularyCard {
  id: string;
  createdAt: string;
  note: Note;
  vocabulary: {
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
  };
}

async function getAccessToken(): Promise<string> {
  const state = useAuthStore.getState();
  if (state.accessToken) return state.accessToken;
  const session = await authApi.refresh();
  state.setSession(session);
  return session.accessToken;
}

async function noteRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (response.status === 401 && retry) {
    try {
      const session = await authApi.refresh();
      useAuthStore.getState().setSession(session);
      return noteRequest<T>(path, options, false);
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
    throw new Error(message ?? "Note request failed");
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const noteApi = {
  list(params: { page?: number; limit?: number; search?: string } = {}) {
    const query = new URLSearchParams();
    query.set("page", String(params.page ?? 1));
    query.set("limit", String(params.limit ?? 20));
    if (params.search?.trim()) query.set("search", params.search.trim());
    return noteRequest<NotePage>(`/notes?${query.toString()}`);
  },
  get: (id: string) => noteRequest<Note>(`/notes/${id}`),
  create: (input: NoteInput) =>
    noteRequest<Note>("/notes", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: NoteInput) =>
    noteRequest<Note>(`/notes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  delete: (id: string) =>
    noteRequest<void>(`/notes/${id}`, { method: "DELETE" }),
  getVocabularyStatus: (vocabularyId: string) =>
    noteRequest<VocabularyNoteStatus>(`/notes/vocabulary/${vocabularyId}`),
  listSavedVocabulary: () =>
    noteRequest<SavedVocabularyCard[]>("/notes/vocabulary"),
  saveVocabulary: (vocabularyId: string, lessonId: string) =>
    noteRequest<VocabularyNoteStatus>(`/notes/vocabulary/${vocabularyId}`, {
      method: "POST",
      body: JSON.stringify({ lessonId }),
    }),
};
