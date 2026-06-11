import { IsEnum, IsInt, IsMongoId, IsNotEmpty, IsOptional, ValidateIf, Min } from 'class-validator';
import type { GameDifficulty } from '../../../models/game.model';

export class SubmitScoreDto {
  @ValidateIf((o) => o.topicId !== null && o.topicId !== undefined && o.topicId !== '')
  @IsMongoId()
  @IsOptional()
  topicId?: string | null;

  @IsEnum(['EASY', 'MEDIUM', 'HARD'])
  @IsNotEmpty()
  difficulty: GameDifficulty;

  @IsInt()
  @Min(0)
  score: number;

  @IsInt()
  @Min(0)
  timeSpent: number;
}

export class GameQueryDto {
  @IsMongoId()
  @IsNotEmpty()
  topicId: string;

  @IsEnum(['EASY', 'MEDIUM', 'HARD'])
  @IsNotEmpty()
  difficulty: GameDifficulty;
}
