import { Injectable } from '@nestjs/common';
import { PrismaService } from '../configs/db';
import type { GameRepository } from './game.repository';
import type { GameDifficulty, GameScoreInput, GameScoreModel, LeaderboardEntry } from '../models/game.model';

@Injectable()
export class PrismaGameRepository implements GameRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createScore(userId: string, input: GameScoreInput): Promise<GameScoreModel> {
    const score = await this.prisma.gameScore.create({
      data: {
        userId,
        topicId: input.topicId || null,
        difficulty: input.difficulty,
        score: input.score,
        timeSpent: input.timeSpent,
      },
    });
    return score as GameScoreModel;
  }

  async getRank(userId: string, topicId: string | null | undefined, difficulty: GameDifficulty, score: number): Promise<number> {
    if (!topicId) return 0;
    const count = await this.prisma.gameScore.count({
      where: {
        topicId,
        difficulty,
        score: { gt: score },
      },
    });
    return count + 1;
  }

  async getLeaderboard(topicId: string | null | undefined, difficulty: GameDifficulty, limit = 10): Promise<LeaderboardEntry[]> {
    if (!topicId) return [];
    const scores = await this.prisma.gameScore.findMany({
      where: {
        topicId,
        difficulty,
      },
      orderBy: [
        { score: 'desc' },
        { timeSpent: 'asc' },
        { createdAt: 'asc' },
      ],
      take: limit,
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    });

    return scores.map((s, index) => ({
      rank: index + 1,
      score: s.score,
      timeSpent: s.timeSpent,
      createdAt: s.createdAt,
      user: {
        displayName: s.user.displayName,
        email: s.user.email,
      },
    }));
  }

  async getVocabulariesForGame(topicId: string, limit: number): Promise<any[]> {
    const vocabularies = await this.prisma.vocabulary.findMany({
      where: { topicId },
      select: {
        id: true,
        word: true,
        meaning: true,
        meaningVi: true,
      },
    });

    // Shuffle vocabularies using Fisher-Yates algorithm
    const shuffled = [...vocabularies];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, limit);
  }
}
