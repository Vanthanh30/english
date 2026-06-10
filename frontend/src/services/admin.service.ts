import { authApi } from "./auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { API_URL } from "./api";

export type ContentLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type LessonStatus = "DRAFT" | "PUBLISHED";

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PageQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface TopicQuery extends PageQuery {
  level?: ContentLevel;
  isActive?: boolean;
}

export interface VocabularyQuery extends PageQuery {
  topicId?: string;
}

export interface LessonQuery extends PageQuery {
  topicId?: string;
  status?: LessonStatus;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string;
  level: ContentLevel;
  imageUrl: string | null;
  imagePublicId: string | null;
  order: number;
  isActive: boolean;
  _count?: { vocabularies: number; lessons: number };
}

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
  imagePublicId: string | null;
  audioUrl: string | null;
  topic?: Pick<Topic, "id" | "name" | "slug">;
}

export interface Lesson {
  id: string;
  topicId: string;
  title: string;
  slug: string;
  description: string;
  level: ContentLevel;
  status: LessonStatus;
  publishedAt: string | null;
  topic?: Pick<Topic, "id" | "name" | "slug">;
  _count?: { items: number };
  items?: Array<{ order: number; vocabulary: Vocabulary }>;
}

interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

async function getAccessToken(): Promise<string> {
  const state = useAuthStore.getState();
  if (state.accessToken) return state.accessToken;
  const session = await authApi.refresh();
  state.setSession(session);
  return session.accessToken;
}

async function adminRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const accessToken = await getAccessToken();
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    cache: "no-store",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401 && retry) {
    const session = await authApi.refresh();
    useAuthStore.getState().setSession(session);
    return adminRequest<T>(path, options, false);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(". ")
      : body?.message;
    throw new Error(message ?? "Admin request failed");
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function queryString(query: object) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

export const adminApi = {
  topics: {
    list: (query: TopicQuery = {}) =>
      adminRequest<PageResult<Topic>>(
        `/admin/content/topics${queryString(query)}`,
      ),
    create: (data: Omit<Topic, "id" | "_count">) =>
      adminRequest<Topic>("/admin/content/topics", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Topic>) =>
      adminRequest<Topic>(`/admin/content/topics/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      adminRequest<void>(`/admin/content/topics/${id}`, { method: "DELETE" }),
  },
  vocabularies: {
    list: (query: VocabularyQuery = {}) =>
      adminRequest<PageResult<Vocabulary>>(
        `/admin/content/vocabularies${queryString(query)}`,
      ),
    create: (data: Omit<Vocabulary, "id" | "topic">) =>
      adminRequest<Vocabulary>("/admin/content/vocabularies", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Vocabulary>) =>
      adminRequest<Vocabulary>(`/admin/content/vocabularies/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      adminRequest<void>(`/admin/content/vocabularies/${id}`, {
        method: "DELETE",
      }),
  },
  lessons: {
    list: (query: LessonQuery = {}) =>
      adminRequest<PageResult<Lesson>>(
        `/admin/content/lessons${queryString(query)}`,
      ),
    get: (id: string) =>
      adminRequest<Lesson>(`/admin/content/lessons/${id}`),
    create: (data: {
      topicId: string;
      title: string;
      description: string;
      level: ContentLevel;
      vocabularyIds: string[];
    }) =>
      adminRequest<Lesson>("/admin/content/lessons", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        topicId: string;
        title: string;
        description: string;
        level: ContentLevel;
        vocabularyIds: string[];
      },
    ) =>
      adminRequest<Lesson>(`/admin/content/lessons/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    publish: (id: string) =>
      adminRequest<Lesson>(`/admin/content/lessons/${id}/publish`, {
        method: "POST",
      }),
    delete: (id: string) =>
      adminRequest<void>(`/admin/content/lessons/${id}`, {
        method: "DELETE",
      }),
  },
  uploadImage: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return adminRequest<UploadedImage>("/admin/uploads/image", {
      method: "POST",
      body,
    });
  },
};
