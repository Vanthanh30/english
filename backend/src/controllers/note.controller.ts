import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NoteService } from '../services/note.service';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';
import { CurrentUser } from '../middlewares/decorators/current-user.decorator';
import { MongoIdPipe } from '../middlewares/validation.middleware';
import { PageQueryDto } from './dto/content/page-query.dto';
import { CreateNoteDto, UpdateNoteDto } from './dto/note/note.dto';
import { SaveVocabularyNoteDto } from './dto/note/save-vocabulary-note.dto';

@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NoteController {
  constructor(private readonly notes: NoteService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PageQueryDto) {
    return this.notes.list(user.id, query);
  }

  @Get('vocabulary')
  listSavedVocabulary(@CurrentUser() user: AuthenticatedUser) {
    return this.notes.listSavedVocabulary(user.id);
  }

  @Get('vocabulary/:vocabularyId')
  getVocabularyNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vocabularyId', MongoIdPipe) vocabularyId: string,
  ) {
    return this.notes.getVocabularyNote(user.id, vocabularyId);
  }

  @Post('vocabulary/:vocabularyId')
  saveVocabulary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vocabularyId', MongoIdPipe) vocabularyId: string,
    @Body() input: SaveVocabularyNoteDto,
  ) {
    return this.notes.saveVocabulary(user.id, vocabularyId, input.lessonId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.notes.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateNoteDto) {
    return this.notes.create(user.id, input);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Body() input: UpdateNoteDto,
  ) {
    return this.notes.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.notes.delete(user.id, id);
  }
}
