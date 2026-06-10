import { IsMongoId, IsOptional } from 'class-validator';

export class SaveVocabularyNoteDto {
  @IsOptional()
  @IsMongoId()
  lessonId?: string;
}
