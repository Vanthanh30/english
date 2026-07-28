import { API_URL } from "./api";
import { authApi } from "./auth.service";
import { useAuthStore } from "@/stores/auth.store";
import type { ImageWritingSession, NewVocabularyItem } from "@/types";

async function getAccessToken(): Promise<string> {
  const state = useAuthStore.getState();
  if (state.accessToken) return state.accessToken;
  const session = await authApi.refresh();
  state.setSession(session);
  return session.accessToken;
}

async function imageWritingRequest<T>(
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
      return imageWritingRequest<T>(path, options, false);
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

export const imageWritingApi = {
  submit(file: File, userText: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userText", userText);
    return imageWritingRequest<ImageWritingSession>("/image-writing/submit", {
      method: "POST",
      body: formData,
    });
  },

  resubmit(id: string, revisedText: string) {
    return imageWritingRequest<ImageWritingSession>(`/image-writing/${id}/resubmit`, {
      method: "POST",
      body: JSON.stringify({ revisedText }),
    });
  },

  listHistory() {
    return imageWritingRequest<ImageWritingSession[]>("/image-writing");
  },

  getSession(id: string) {
    return imageWritingRequest<ImageWritingSession>(`/image-writing/${id}`);
  },

  deleteSession(id: string) {
    return imageWritingRequest<void>(`/image-writing/${id}`, {
      method: "DELETE",
    });
  },

  saveVocab(vocab: {
    word: string;
    meaning: string;
    meaningVi?: string;
    pronunciation?: string;
    partOfSpeech?: string;
    exampleSentence?: string;
  }) {
    return imageWritingRequest<{
      success: boolean;
      alreadySaved: boolean;
      word: string;
      flashcardId: string;
    }>("/image-writing/save-vocab", {
      method: "POST",
      body: JSON.stringify(vocab),
    });
  },
};
