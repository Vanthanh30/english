export type GameDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface GameScoreModel {
  id: string;
  userId: string;
  topicId: string | null;
  difficulty: GameDifficulty;
  score: number;
  timeSpent: number;
  createdAt: Date;
}

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
  createdAt: Date;
  user: {
    displayName: string;
    email: string;
  };
}

export interface GameScoreResult {
  score: GameScoreModel;
  rank: number;
  leaderboard: LeaderboardEntry[];
}
