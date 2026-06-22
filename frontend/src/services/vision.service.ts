import { API_URL } from "./api";
import { authApi } from "./auth.service";
import { useAuthStore } from "@/stores/auth.store";

export interface VisionWord {
  id: string;
  historyId: string;
  word: string;
  meaning: string;
  meaningVi: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  saved: boolean;
  x: number | null;
  y: number | null;
}

export interface VisionHistory {
  id: string;
  userId: string;
  imageUrl: string;
  imagePublicId: string | null;
  createdAt: string;
  words: VisionWord[];
}

export interface SaveVisionWordInput {
  wordId: string;
  word: string;
  meaning: string;
  meaningVi?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
}

async function getAccessToken(): Promise<string> {
  const state = useAuthStore.getState();
  if (state.accessToken) return state.accessToken;
  const session = await authApi.refresh();
  state.setSession(session);
  return session.accessToken;
}

async function visionRequest<T>(
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
      return visionRequest<T>(path, options, false);
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

export const visionApi = {
  analyzeImage(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return visionRequest<VisionHistory>("/vision/analyze", {
      method: "POST",
      body: formData,
    });
  },

  listHistory() {
    return visionRequest<VisionHistory[]>("/vision/history");
  },

  deleteHistory(id: string) {
    return visionRequest<void>(`/vision/history/${id}`, {
      method: "DELETE",
    });
  },

  saveWords(words: SaveVisionWordInput[]) {
    return visionRequest<{ success: boolean; saved: any[] }>("/vision/save", {
      method: "POST",
      body: JSON.stringify({ words }),
    });
  },

  analyzeClick(
    historyId: string,
    x?: number,
    y?: number,
    xMin?: number,
    yMin?: number,
    xMax?: number,
    yMax?: number,
  ) {
    return visionRequest<VisionWord>(`/vision/history/${historyId}/click`, {
      method: "POST",
      body: JSON.stringify({ x, y, xMin, yMin, xMax, yMax }),
    });
  },
};
