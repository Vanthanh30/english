import { IsArray, IsOptional, IsString, MinLength, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class SaveVisionWordDto {
  @IsString()
  @MinLength(1)
  wordId!: string;

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

export class BatchSaveVisionWordsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveVisionWordDto)
  words!: SaveVisionWordDto[];
}

export class ClickCoordinatesDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  x?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  y?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  xMin?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  yMin?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  xMax?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  yMax?: number;
}


