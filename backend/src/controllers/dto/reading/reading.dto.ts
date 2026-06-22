import { IsString, IsNumber, IsUrl, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { HighlightColor, ReadingNoteType, ReadingStatus } from '../../../models/reading.model';

export class ImportUrlDto {
  @IsUrl({}, { message: 'A valid URL is required' })
  url!: string;
}

export class UpdateBookmarkDto {
  @IsNumber()
  bookmarkPosition!: number;
}

export class UpdateStatusDto {
  @IsString()
  status!: string;
}

export class CreateHighlightDto {
  @IsString()
  @MinLength(1)
  word!: string;

  @IsString()
  color!: string;

  @IsNumber()
  charOffset!: number;
}

export class CreateReadingNoteDto {
  @IsString()
  noteType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;
}

export class UpdateReadingNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;
}

export class SaveFlashcardDto {
  @IsString()
  @MinLength(1)
  word!: string;

  @IsString()
  meaning!: string;

  @IsString()
  @IsOptional()
  meaningVi?: string;

  @IsString()
  @IsOptional()
  pronunciation?: string;

  @IsString()
  @IsOptional()
  partOfSpeech?: string;

  @IsString()
  @IsOptional()
  exampleSentence?: string;
}
