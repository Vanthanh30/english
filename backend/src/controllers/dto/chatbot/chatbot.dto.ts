import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;
}
