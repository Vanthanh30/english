import { API_URL } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: "STUDENT" | "ADMIN";
  emailVerifiedAt: string | null;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(". ")
      : body?.message;
    throw new Error(message ?? "The request could not be completed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const authApi = {
  register(input: {
    email: string;
    displayName: string;
    password: string;
  }) {
    return request<{ message: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  verifyEmail(token: string) {
    return request<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  login(input: { email: string; password: string }) {
    return request<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  refresh() {
    return request<AuthSession>("/auth/refresh", { method: "POST" });
  },

  logout() {
    return request<void>("/auth/logout", { method: "POST" });
  },

  me(accessToken: string) {
    return request<AuthUser>("/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
};
