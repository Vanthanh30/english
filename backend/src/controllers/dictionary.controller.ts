import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ReadingService } from '../services/reading.service';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';
import { CurrentUser } from '../middlewares/decorators/current-user.decorator';
import { SaveFlashcardDto } from './dto/reading/reading.dto';

@Controller('dictionary')
@UseGuards(JwtAuthGuard)
export class DictionaryController {
  constructor(private readonly readingService: ReadingService) {}

  @Get('lookup')
  lookup(@Query('word') word: string) {
    if (!word || !word.trim()) {
      throw new BadRequestException('Query parameter "word" is required');
    }
    return this.readingService.lookupWord(word);
  }

  @Post('flashcard')
  saveToFlashcard(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SaveFlashcardDto,
  ) {
    return this.readingService.saveWordToFlashcard(user.id, body);
  }
}
