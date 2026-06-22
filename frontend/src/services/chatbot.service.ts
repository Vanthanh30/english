import { API_URL } from "./api";
import { authApi } from "./auth.service";
import { useAuthStore } from "@/stores/auth.store";

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "model";
  content: string;
  createdAt: string;
}

async function getAccessToken(): Promise<string> {
  const state = useAuthStore.getState();
  if (state.accessToken) return state.accessToken;
  const session = await authApi.refresh();
  state.setSession(session);
  return session.accessToken;
}

async function chatbotRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (options.headers) {
    Object.assign(headers, options.headers);
  }
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (response.status === 401 && retry) {
    try {
      const session = await authApi.refresh();
      useAuthStore.getState().setSession(session);
      return chatbotRequest<T>(path, options, false);
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
    throw new Error(message ?? "Chatbot request failed");
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const chatbotApi = {
  listSessions: () => chatbotRequest<ChatSession[]>("/chatbot/sessions"),
  createSession: (title: string) =>
    chatbotRequest<ChatSession>("/chatbot/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  getSession: (id: string) => chatbotRequest<ChatSession>(`/chatbot/sessions/${id}`),
  deleteSession: (id: string) =>
    chatbotRequest<void>(`/chatbot/sessions/${id}`, { method: "DELETE" }),
  listMessages: (sessionId: string) =>
    chatbotRequest<ChatMessage[]>(`/chatbot/sessions/${sessionId}/messages`),
  sendMessage: (sessionId: string, message: string) =>
    chatbotRequest<ChatMessage>(`/chatbot/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  uploadFile: (sessionId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return chatbotRequest<ChatMessage>(`/chatbot/sessions/${sessionId}/messages/upload`, {
      method: "POST",
      body: formData,
    });
  },
};
