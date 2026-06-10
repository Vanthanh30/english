import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(50_000)
  contentHtml!: string;
}

export class UpdateNoteDto extends CreateNoteDto {}
