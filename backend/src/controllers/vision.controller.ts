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
import { VisionService } from '../services/vision.service';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';
import { CurrentUser } from '../middlewares/decorators/current-user.decorator';
import { MongoIdPipe } from '../middlewares/validation.middleware';
import { BatchSaveVisionWordsDto, ClickCoordinatesDto } from './dto/vision/vision.dto';

@Controller('vision')
@UseGuards(JwtAuthGuard)
export class VisionController {
  constructor(private readonly visionService: VisionService) {}

  @Post('analyze')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20_000_000 } }))
  analyze(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: 20_000_000 })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    return this.visionService.analyzeImage(user.id, file);
  }

  @Get('history')
  listHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.visionService.listHistory(user.id);
  }

  @Get('history/:id')
  getHistoryItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.visionService.getHistoryItem(user.id, id);
  }

  @Delete('history/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.visionService.deleteHistory(user.id, id);
  }

  @Post('history/:id/click')
  analyzeClick(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Body() body: ClickCoordinatesDto,
  ) {
    return this.visionService.analyzeClickCoordinates(
      user.id,
      id,
      body.x,
      body.y,
      body.xMin,
      body.yMin,
      body.xMax,
      body.yMax,
    );
  }

  @Post('save')
  saveWords(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: BatchSaveVisionWordsDto,
  ) {
    return this.visionService.saveWordsToFlashcard(user.id, body.words);
  }
}
