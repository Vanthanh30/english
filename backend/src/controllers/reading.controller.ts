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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReadingService } from '../services/reading.service';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';
import { CurrentUser } from '../middlewares/decorators/current-user.decorator';
import { MongoIdPipe } from '../middlewares/validation.middleware';
import { SourceType, ReadingStatus } from '../models/reading.model';
import {
  ImportUrlDto,
  UpdateBookmarkDto,
  UpdateStatusDto,
  CreateHighlightDto,
  CreateReadingNoteDto,
  UpdateReadingNoteDto,
} from './dto/reading/reading.dto';

@Controller('reading')
@UseGuards(JwtAuthGuard)
export class ReadingController {
  constructor(private readonly readingService: ReadingService) {}

  @Post('import-url')
  importUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ImportUrlDto,
  ) {
    return this.readingService.importFromUrl(user.id, body.url);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20_000_000 } }))
  uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.readingService.importFromFile(user.id, file);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('sourceType') sourceType?: string,
    @Query('search') search?: string,
  ) {
    return this.readingService.listLibrary(user.id, {
      status: status as any,
      sourceType: sourceType as any,
      search,
    });
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.readingService.getReadingItem(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.readingService.deleteReadingItem(user.id, id);
  }

  @Patch(':id/bookmark')
  updateBookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Body() body: UpdateBookmarkDto,
  ) {
    return this.readingService.updateBookmark(user.id, id, body.bookmarkPosition);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Body() body: UpdateStatusDto,
  ) {
    return this.readingService.updateStatus(user.id, id, body.status as any);
  }

  // Highlights
  @Get(':id/highlights')
  listHighlights(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.readingService.listHighlights(user.id, id);
  }

  @Post(':id/highlights')
  addHighlight(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Body() body: CreateHighlightDto,
  ) {
    return this.readingService.addHighlight(user.id, id, body as any);
  }

  @Delete(':id/highlights/:highlightId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeHighlight(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Param('highlightId', MongoIdPipe) highlightId: string,
  ) {
    return this.readingService.removeHighlight(user.id, id, highlightId);
  }

  // Notes
  @Get(':id/notes')
  listNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.readingService.listNotes(user.id, id);
  }

  @Post(':id/notes')
  createNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Body() body: CreateReadingNoteDto,
  ) {
    return this.readingService.createNote(user.id, id, body as any);
  }

  @Patch(':id/notes/:noteId')
  updateNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Param('noteId', MongoIdPipe) noteId: string,
    @Body() body: UpdateReadingNoteDto,
  ) {
    return this.readingService.updateNote(user.id, id, noteId, body.content);
  }

  @Delete(':id/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Param('noteId', MongoIdPipe) noteId: string,
  ) {
    return this.readingService.deleteNote(user.id, id, noteId);
  }
}
