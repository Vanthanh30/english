import type { GameDifficulty, GameScoreModel, GameScoreInput, LeaderboardEntry } from '../models/game.model';

export const GAME_REPOSITORY = Symbol('GAME_REPOSITORY');

export interface GameRepository {
  createScore(userId: string, input: GameScoreInput): Promise<GameScoreModel>;
  getRank(userId: string, topicId: string | null | undefined, difficulty: GameDifficulty, score: number): Promise<number>;
  getLeaderboard(topicId: string | null | undefined, difficulty: GameDifficulty, limit?: number): Promise<LeaderboardEntry[]>;
  getVocabulariesForGame(topicId: string, limit: number): Promise<any[]>;
}
