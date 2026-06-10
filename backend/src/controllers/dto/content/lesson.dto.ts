import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { ContentLevel, LessonStatus } from '../../../models/course.model';
import { PageQueryDto } from './page-query.dto';

const LEVELS: ContentLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const STATUSES: LessonStatus[] = ['DRAFT', 'PUBLISHED'];

export class LessonQueryDto extends PageQueryDto {
  @IsOptional()
  @IsMongoId()
  topicId?: string;

  @IsOptional()
  @IsEnum(STATUSES)
  status?: LessonStatus;
}

export class CreateLessonDto {
  @IsMongoId()
  topicId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  slug?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  description!: string;

  @IsEnum(LEVELS)
  level: ContentLevel = 'BEGINNER';

  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  vocabularyIds: string[] = [];
}

export class UpdateLessonDto {
  @IsOptional()
  @IsMongoId()
  topicId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(LEVELS)
  level?: ContentLevel;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  vocabularyIds?: string[];
}
