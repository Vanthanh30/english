import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { ContentLevel } from '../../../models/course.model';
import { PageQueryDto } from './page-query.dto';

const LEVELS: ContentLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

export class TopicQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(LEVELS)
  level?: ContentLevel;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}

export class CreateTopicDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  description!: string;

  @IsEnum(LEVELS)
  level: ContentLevel = 'BEGINNER';

  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imagePublicId?: string;

  @IsInt()
  @Min(0)
  @Max(10_000)
  order = 0;

  @IsBoolean()
  isActive = true;
}

export class UpdateTopicDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(LEVELS)
  level?: ContentLevel;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imagePublicId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
