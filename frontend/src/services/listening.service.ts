import { API_URL } from "./api";
import { authApi } from "./auth.service";
import { useAuthStore } from "@/stores/auth.store";

export type ContentLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface ListeningSentence {
  id: string;
  topicId: string;
  text: string;
  vietnameseTranslation: string | null;
  startTime: number | null;
  endTime: number | null;
  order: number;
}

export interface ListeningProgress {
  id: string;
  userId: string;
  topicId: string;
  completed: boolean;
  listenedCount: number;
  errorCount: number;
  completedSentences: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ListeningTopic {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  audioUrl: string | null;
  audioPublicId: string | null;
  youtubeUrl: string | null;
  transcript: string;
  level: ContentLevel;
  createdAt: string;
  updatedAt: string;
  sentences?: ListeningSentence[];
  progress?: ListeningProgress | null;
  sentenceCount?: number;
  status?: "DRAFT" | "PUBLISHED";
  studyMode?: "both" | "full" | "blank";
  activeHints?: string[];
  maxPlays?: number;
  errorLimit?: number;
}

async function getAccessToken(): Promise<string> {
  const state = useAuthStore.getState();
  if (state.accessToken) return state.accessToken;
  const session = await authApi.refresh();
  state.setSession(session);
  return session.accessToken;
}

async function listeningRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (response.status === 401 && retry) {
    try {
      const session = await authApi.refresh();
      useAuthStore.getState().setSession(session);
      return listeningRequest<T>(path, options, false);
    } catch (error) {
      useAuthStore.getState().clearSession();
      throw error;
    }
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const msg = Array.isArray(errorBody?.message)
      ? errorBody.message.join(". ")
      : errorBody?.message;
    throw new Error(msg ?? "Listening API Request Failed");
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function buildQuery(query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, val]) => {
    if (val !== undefined && val !== "") {
      params.set(key, val);
    }
  });
  const str = params.toString();
  return str ? `?${str}` : "";
}

export const listeningService = {
  // Student endpoints
  async listTopics(filters: { level?: string; search?: string } = {}): Promise<ListeningTopic[]> {
    return listeningRequest<ListeningTopic[]>(`/listening-topics${buildQuery(filters)}`);
  },

  async getTopic(idOrSlug: string): Promise<ListeningTopic> {
    return listeningRequest<ListeningTopic>(`/listening-topics/${idOrSlug}`);
  },

  async updateProgress(
    topicId: string,
    data: { completedSentences: string[]; listenedCount: number; errorCount: number }
  ): Promise<ListeningProgress> {
    return listeningRequest<ListeningProgress>(`/listening-topics/${topicId}/progress`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Admin endpoints (CMS)
  async listAdminTopics(filters: { level?: string; search?: string } = {}): Promise<ListeningTopic[]> {
    return listeningRequest<ListeningTopic[]>(`/admin/listening-topics${buildQuery(filters)}`);
  },

  async getAdminTopic(id: string): Promise<ListeningTopic> {
    return listeningRequest<ListeningTopic>(`/admin/listening-topics/${id}`);
  },

  async createAdminTopic(data: Omit<ListeningTopic, "id" | "slug" | "createdAt" | "updatedAt" | "sentences" | "transcript"> & { transcript?: string; sentences?: Omit<ListeningSentence, "id" | "topicId">[] }): Promise<ListeningTopic> {
    return listeningRequest<ListeningTopic>("/admin/listening-topics", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateAdminTopic(
    id: string,
    data: Partial<Omit<ListeningTopic, "id" | "slug" | "createdAt" | "updatedAt" | "sentences">> & { sentences?: Omit<ListeningSentence, "id" | "topicId">[] }
  ): Promise<ListeningTopic> {
    return listeningRequest<ListeningTopic>(`/admin/listening-topics/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteAdminTopic(id: string): Promise<void> {
    return listeningRequest<void>(`/admin/listening-topics/${id}`, {
      method: "DELETE",
    });
  },

  async autoTranscribe(data: { audioUrl?: string; youtubeUrl?: string }): Promise<{ transcript: string; sentences: Omit<ListeningSentence, "id" | "topicId">[] }> {
    return listeningRequest<{ transcript: string; sentences: Omit<ListeningSentence, "id" | "topicId">[] }>("/admin/listening-topics/auto-transcribe", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async uploadAudio(file: File): Promise<{ url: string; publicId: string }> {
    const accessToken = await getAccessToken();
    const body = new FormData();
    body.append("file", file);

    const response = await fetch(`${API_URL}/admin/uploads/audio`, {
      method: "POST",
      body,
      credentials: "include",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as {
        message?: string | string[];
      } | null;
      const msg = Array.isArray(errorBody?.message)
        ? errorBody.message.join(". ")
        : errorBody?.message;
      throw new Error(msg ?? "Audio upload failed");
    }

    return response.json();
  },
};
