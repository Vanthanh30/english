import { API_URL } from "./api";
import { authApi } from "./auth.service";
import { useAuthStore } from "@/stores/auth.store";

export interface Vocabulary {
  id: string;
  topicId: string;
  word: string;
  meaning: string;
  meaningVi: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
}

export interface Flashcard {
  id: string;
  userId: string;
  vocabularyId: string;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  vocabulary: Vocabulary;
}

export type ReviewDifficulty = "easy" | "medium" | "hard";
export type WritingPracticeMode = "listening" | "meaning";

export interface WritingPracticeResult {
  correct: boolean;
  expectedAnswer: string;
  mode: WritingPracticeMode;
  difficulty: ReviewDifficulty;
  flashcard: Flashcard;
}

async function getAccessToken(): Promise<string> {
  const state = useAuthStore.getState();
  if (state.accessToken) return state.accessToken;
  const session = await authApi.refresh();
  state.setSession(session);
  return session.accessToken;
}

async function flashcardRequest<T>(
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
      return flashcardRequest<T>(path, options, false);
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
    throw new Error(message ?? "Flashcard request failed");
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const flashcardApi = {
  list: () => flashcardRequest<Flashcard[]>("/flashcards"),
  listDue: () => flashcardRequest<Flashcard[]>("/flashcards/due"),
  save: (vocabularyId: string) =>
    flashcardRequest<Flashcard>(`/flashcards/vocabulary/${vocabularyId}`, {
      method: "POST",
    }),
  review: (id: string, difficulty: ReviewDifficulty) =>
    flashcardRequest<Flashcard>(`/flashcards/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ difficulty }),
    }),
  submitWritingPractice: (
    id: string,
    mode: WritingPracticeMode,
    answer: string,
  ) =>
    flashcardRequest<WritingPracticeResult>(
      `/flashcards/${id}/writing-practice`,
      {
        method: "POST",
        body: JSON.stringify({ mode, answer }),
      },
    ),
  makeDue: (ids: string[]) =>
    flashcardRequest<{ success: boolean }>("/flashcards/make-due", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  delete: (id: string) =>
    flashcardRequest<void>(`/flashcards/${id}`, { method: "DELETE" }),
};
