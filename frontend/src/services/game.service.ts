import { API_URL } from "./api";
import { authApi } from "./auth.service";
import { useAuthStore } from "@/stores/auth.store";

export type GameDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface GameScoreInput {
  topicId?: string | null;
  difficulty: GameDifficulty;
  score: number;
  timeSpent: number;
}

export interface LeaderboardEntry {
  rank: number;
  score: number;
  timeSpent: number;
  createdAt: string;
  user: {
    displayName: string;
    email: string;
  };
}

export interface GameScoreResult {
  score: {
    id: string;
    userId: string;
    topicId: string | null;
    difficulty: GameDifficulty;
    score: number;
    timeSpent: number;
    createdAt: string;
  };
  rank: number;
  leaderboard: LeaderboardEntry[];
}

export interface GameVocabulary {
  id: string;
  word: string;
  meaning: string;
  meaningVi: string | null;
}

async function getAccessToken(): Promise<string> {
  const state = useAuthStore.getState();
  if (state.accessToken) return state.accessToken;
  const session = await authApi.refresh();
  state.setSession(session);
  return session.accessToken;
}

async function gameRequest<T>(
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
    return gameRequest<T>(path, options, false);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(". ")
      : body?.message;
    throw new Error(message ?? "Game request failed");
  }

  return (await response.json()) as T;
}

export const gameApi = {
  getVocabularies: (topicId: string, difficulty: GameDifficulty) =>
    gameRequest<GameVocabulary[]>(`/game/vocabularies?topicId=${topicId}&difficulty=${difficulty}`),

  submitScore: (input: GameScoreInput) =>
    gameRequest<GameScoreResult>("/game/scores", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getLeaderboard: (topicId: string, difficulty: GameDifficulty) =>
    gameRequest<LeaderboardEntry[]>(`/game/leaderboard?topicId=${topicId}&difficulty=${difficulty}`),
};
