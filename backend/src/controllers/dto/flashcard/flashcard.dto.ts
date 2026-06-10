import { IsIn, IsString } from 'class-validator';
import type { ReviewDifficulty } from '../../../models/flashcard.model';

export class ReviewFlashcardDto {
  @IsString()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty!: ReviewDifficulty;
}
