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
import { ContentService } from '../services/content.service';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import { RolesGuard } from '../middlewares/admin.middleware';
import { Roles } from '../middlewares/decorators/roles.decorator';
import {
  CreateTopicDto,
  TopicQueryDto,
  UpdateTopicDto,
} from './dto/content/topic.dto';
import {
  CreateVocabularyDto,
  UpdateVocabularyDto,
  VocabularyQueryDto,
} from './dto/content/vocabulary.dto';
import {
  CreateLessonDto,
  LessonQueryDto,
  UpdateLessonDto,
} from './dto/content/lesson.dto';
import { MongoIdPipe } from '../middlewares/validation.middleware';

@Controller('admin/content')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminContentController {
  constructor(private readonly content: ContentService) {}

  @Get('topics')
  listTopics(@Query() query: TopicQueryDto) {
    return this.content.listTopics(query);
  }

  @Get('topics/:id')
  getTopic(@Param('id', MongoIdPipe) id: string) {
    return this.content.getTopic(id);
  }

  @Post('topics')
  createTopic(@Body() input: CreateTopicDto) {
    return this.content.createTopic(input);
  }

  @Patch('topics/:id')
  updateTopic(
    @Param('id', MongoIdPipe) id: string,
    @Body() input: UpdateTopicDto,
  ) {
    return this.content.updateTopic(id, input);
  }

  @Delete('topics/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTopic(@Param('id', MongoIdPipe) id: string) {
    return this.content.deleteTopic(id);
  }

  @Get('vocabularies')
  listVocabularies(@Query() query: VocabularyQueryDto) {
    return this.content.listVocabularies(query);
  }

  @Get('vocabularies/:id')
  getVocabulary(@Param('id', MongoIdPipe) id: string) {
    return this.content.getVocabulary(id);
  }

  @Post('vocabularies')
  createVocabulary(@Body() input: CreateVocabularyDto) {
    return this.content.createVocabulary(input);
  }

  @Patch('vocabularies/:id')
  updateVocabulary(
    @Param('id', MongoIdPipe) id: string,
    @Body() input: UpdateVocabularyDto,
  ) {
    return this.content.updateVocabulary(id, input);
  }

  @Delete('vocabularies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteVocabulary(@Param('id', MongoIdPipe) id: string) {
    return this.content.deleteVocabulary(id);
  }

  @Get('lessons')
  listLessons(@Query() query: LessonQueryDto) {
    return this.content.listLessons(query);
  }

  @Get('lessons/:id')
  getLesson(@Param('id', MongoIdPipe) id: string) {
    return this.content.getLesson(id);
  }

  @Post('lessons')
  createLesson(@Body() input: CreateLessonDto) {
    return this.content.createLesson(input);
  }

  @Patch('lessons/:id')
  updateLesson(
    @Param('id', MongoIdPipe) id: string,
    @Body() input: UpdateLessonDto,
  ) {
    return this.content.updateLesson(id, input);
  }

  @Post('lessons/:id/publish')
  publishLesson(@Param('id', MongoIdPipe) id: string) {
    return this.content.publishLesson(id);
  }

  @Delete('lessons/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteLesson(@Param('id', MongoIdPipe) id: string) {
    return this.content.deleteLesson(id);
  }
}
