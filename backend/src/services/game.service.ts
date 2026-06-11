import { Inject, Injectable } from '@nestjs/common';
import { GAME_REPOSITORY, type GameRepository } from '../repositories/game.repository';
import type { GameDifficulty, GameScoreInput } from '../models/game.model';

@Injectable()
export class GameService {
  constructor(
    @Inject(GAME_REPOSITORY)
    private readonly repository: GameRepository,
  ) {}

  async getVocabulariesForGame(topicId: string, difficulty: GameDifficulty) {
    let limit = 6;
    if (difficulty === 'MEDIUM') limit = 8;
    if (difficulty === 'HARD') limit = 10;

    return this.repository.getVocabulariesForGame(topicId, limit);
  }

  async submitScore(userId: string, input: GameScoreInput) {
    const score = await this.repository.createScore(userId, input);
    const rank = await this.repository.getRank(userId, input.topicId, input.difficulty, input.score);
    const leaderboard = await this.repository.getLeaderboard(input.topicId, input.difficulty);

    return {
      score,
      rank,
      leaderboard,
    };
  }

  async getLeaderboard(topicId: string, difficulty: GameDifficulty) {
    return this.repository.getLeaderboard(topicId, difficulty);
  }
}
