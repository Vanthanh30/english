import { IsOptional, IsString, MinLength } from 'class-validator';

export class SubmitImageWritingDto {
  @IsString()
  @MinLength(20, { message: 'Writing description must be at least 20 characters long.' })
  userText!: string;
}

export class ResubmitImageWritingDto {
  @IsString()
  @MinLength(20, { message: 'Revised description must be at least 20 characters long.' })
  revisedText!: string;
}

export class SaveWritingVocabularyDto {
  @IsString()
  @MinLength(1)
  word!: string;

  @IsString()
  @MinLength(1)
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
