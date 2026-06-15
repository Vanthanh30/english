import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FlashcardService } from '../services/flashcard.service';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';
import { CurrentUser } from '../middlewares/decorators/current-user.decorator';
import { MongoIdPipe } from '../middlewares/validation.middleware';
import {
  ReviewFlashcardDto,
  SubmitWritingPracticeDto,
} from './dto/flashcard/flashcard.dto';

@Controller('flashcards')
@UseGuards(JwtAuthGuard)
export class FlashcardController {
  constructor(private readonly flashcards: FlashcardService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.flashcards.list(user.id);
  }

  @Get('due')
  listDue(@CurrentUser() user: AuthenticatedUser) {
    return this.flashcards.listDue(user.id);
  }

  @Post('vocabulary/:vocabularyId')
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vocabularyId', MongoIdPipe) vocabularyId: string,
  ) {
    return this.flashcards.save(user.id, vocabularyId);
  }

  @Post(':id/review')
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Body() input: ReviewFlashcardDto,
  ) {
    return this.flashcards.review(user.id, id, input.difficulty);
  }

  @Post(':id/writing-practice')
  submitWritingPractice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Body() input: SubmitWritingPracticeDto,
  ) {
    return this.flashcards.submitWritingPractice(
      user.id,
      id,
      input.mode,
      input.answer,
    );
  }

  @Post('make-due')
  @HttpCode(HttpStatus.OK)
  async makeDue(
    @CurrentUser() user: AuthenticatedUser,
    @Body('ids') ids: string[],
  ) {
    await this.flashcards.makeDue(user.id, ids);
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.flashcards.delete(user.id, id);
  }
}
