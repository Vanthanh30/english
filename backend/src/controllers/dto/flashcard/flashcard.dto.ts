import { IsIn, IsString, MaxLength } from 'class-validator';
import type {
  ReviewDifficulty,
  WritingPracticeMode,
} from '../../../models/flashcard.model';

export class ReviewFlashcardDto {
  @IsString()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty!: ReviewDifficulty;
}

export class SubmitWritingPracticeDto {
  @IsString()
  @IsIn(['listening', 'meaning'])
  mode!: WritingPracticeMode;

  @IsString()
  @MaxLength(100)
  answer!: string;
}
