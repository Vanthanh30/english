import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContentLevel, LessonStatus } from '@prisma/client';

export class CreateListeningSentenceDto {
  @IsString()
  text: string;

  @IsString()
  @IsOptional()
  vietnameseTranslation?: string;

  @IsNumber()
  @IsOptional()
  startTime?: number;

  @IsNumber()
  @IsOptional()
  endTime?: number;

  @IsNumber()
  order: number;
}

export class CreateListeningTopicDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  audioUrl?: string;

  @IsString()
  @IsOptional()
  audioPublicId?: string;

  @IsString()
  @IsOptional()
  youtubeUrl?: string;

  @IsString()
  @IsOptional()
  transcript?: string;

  @IsEnum(ContentLevel)
  level: ContentLevel;

  @IsEnum(LessonStatus)
  @IsOptional()
  status?: LessonStatus;

  @IsString()
  @IsOptional()
  studyMode?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  activeHints?: string[];

  @IsNumber()
  @IsOptional()
  maxPlays?: number;

  @IsNumber()
  @IsOptional()
  errorLimit?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateListeningSentenceDto)
  sentences?: CreateListeningSentenceDto[];
}

export class UpdateListeningTopicDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  audioUrl?: string;

  @IsString()
  @IsOptional()
  audioPublicId?: string;

  @IsString()
  @IsOptional()
  youtubeUrl?: string;

  @IsString()
  @IsOptional()
  transcript?: string;

  @IsEnum(ContentLevel)
  @IsOptional()
  level?: ContentLevel;

  @IsEnum(LessonStatus)
  @IsOptional()
  status?: LessonStatus;

  @IsString()
  @IsOptional()
  studyMode?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  activeHints?: string[];

  @IsNumber()
  @IsOptional()
  maxPlays?: number;

  @IsNumber()
  @IsOptional()
  errorLimit?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateListeningSentenceDto)
  sentences?: CreateListeningSentenceDto[];
}

export class AutoTranscribeDto {
  @IsString()
  @IsOptional()
  audioUrl?: string;

  @IsString()
  @IsOptional()
  youtubeUrl?: string;
}

export class UpdateProgressDto {
  @IsArray()
  @IsString({ each: true })
  completedSentences: string[];

  @IsNumber()
  @Min(0)
  listenedCount: number;

  @IsNumber()
  @Min(0)
  errorCount: number;
}
