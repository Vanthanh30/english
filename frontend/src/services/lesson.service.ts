import { API_URL } from "./api";
import { authApi } from "./auth.service";
import { useAuthStore } from "@/stores/auth.store";

export interface LearningProgress {
  completedVocabulary: number;
  totalVocabulary: number;
  percentage: number;
  completedAt: string | null;
}

export interface LearningLessonSummary {
  id: string;
  topicId: string;
  title: string;
  slug: string;
  description: string;
  level: string;
  progress: LearningProgress;
}

export interface LearningTopic {
  id: string;
  name: string;
  slug: string;
  description: string;
  level: string;
  imageUrl: string | null;
  lessons: LearningLessonSummary[];
  progress: LearningProgress;
}

export interface LearningVocabulary {
  id: string;
  word: string;
  meaning: string;
  meaningVi: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  order: number;
  completed: boolean;
}

export interface LearningLesson extends LearningLessonSummary {
  topic: {
    id: string;
    name: string;
    slug: string;
  };
  vocabularies: LearningVocabulary[];
}

async function getAccessToken(): Promise<string> {
  const state = useAuthStore.getState();
  if (state.accessToken) return state.accessToken;
  const session = await authApi.refresh();
  state.setSession(session);
  return session.accessToken;
}

async function learningRequest<T>(
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
    const session = await authApi.refresh();
    useAuthStore.getState().setSession(session);
    return learningRequest<T>(path, options, false);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(". ")
      : body?.message;
    throw new Error(message ?? "Learning request failed");
  }

  return (await response.json()) as T;
}

export const lessonApi = {
  listTopics: () => learningRequest<LearningTopic[]>("/learning/topics"),
  listByTopic: (topicId: string) =>
    learningRequest<LearningLessonSummary[]>(
      `/learning/topics/${topicId}/lessons`,
    ),
  get: (lessonId: string) =>
    learningRequest<LearningLesson>(`/learning/lessons/${lessonId}`),
  completeVocabulary: (lessonId: string, vocabularyId: string) =>
    learningRequest<LearningLesson>(
      `/learning/lessons/${lessonId}/vocabularies/${vocabularyId}/complete`,
      { method: "POST" },
    ),
  complete: (lessonId: string) =>
    learningRequest<LearningLesson>(
      `/learning/lessons/${lessonId}/complete`,
      { method: "POST" },
    ),
};
