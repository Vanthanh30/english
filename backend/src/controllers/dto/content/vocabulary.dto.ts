import {
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PageQueryDto } from './page-query.dto';

export class VocabularyQueryDto extends PageQueryDto {
  @IsOptional()
  @IsMongoId()
  topicId?: string;
}

export class CreateVocabularyDto {
  @IsMongoId()
  topicId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  word!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  meaning!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  meaningVi!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pronunciation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  partOfSpeech?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  exampleSentence?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imagePublicId?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  audioUrl?: string;
}

export class UpdateVocabularyDto {
  @IsOptional()
  @IsMongoId()
  topicId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  word?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  meaning?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  meaningVi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pronunciation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  partOfSpeech?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  exampleSentence?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imagePublicId?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  audioUrl?: string;
}
