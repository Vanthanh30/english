import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageWritingService } from '../services/image-writing.service';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';
import { CurrentUser } from '../middlewares/decorators/current-user.decorator';
import { MongoIdPipe } from '../middlewares/validation.middleware';
import {
  SubmitImageWritingDto,
  ResubmitImageWritingDto,
  SaveWritingVocabularyDto,
} from './dto/image-writing/image-writing.dto';

@Controller('image-writing')
@UseGuards(JwtAuthGuard)
export class ImageWritingController {
  constructor(private readonly imageWritingService: ImageWritingService) {}

  @Post('submit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5_000_000 } }))
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: 5_000_000 })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
    @Body() body: SubmitImageWritingDto,
  ) {
    return this.imageWritingService.submitSession(user.id, file, body.userText);
  }

  @Post(':id/resubmit')
  resubmit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Body() body: ResubmitImageWritingDto,
  ) {
    return this.imageWritingService.resubmitSession(user.id, id, body.revisedText);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.imageWritingService.listSessions(user.id);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.imageWritingService.getSession(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.imageWritingService.deleteSession(user.id, id);
  }

  @Post('save-vocab')
  saveVocab(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SaveWritingVocabularyDto,
  ) {
    return this.imageWritingService.saveWordToFlashcards(user.id, body);
  }
}
