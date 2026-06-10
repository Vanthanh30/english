import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { LessonService } from '../services/lesson.service';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../middlewares/auth.middleware';
import { CurrentUser } from '../middlewares/decorators/current-user.decorator';
import { MongoIdPipe } from '../middlewares/validation.middleware';

@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LessonController {
  constructor(private readonly lessons: LessonService) {}

  @Get('topics')
  listTopics(@CurrentUser() user: AuthenticatedUser) {
    return this.lessons.listTopics(user.id);
  }

  @Get('topics/:topicId/lessons')
  listLessons(
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId', MongoIdPipe) topicId: string,
  ) {
    return this.lessons.listLessons(user.id, topicId);
  }

  @Get('lessons/:lessonId')
  getLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', MongoIdPipe) lessonId: string,
  ) {
    return this.lessons.getLesson(user.id, lessonId);
  }

  @Post('lessons/:lessonId/vocabularies/:vocabularyId/complete')
  completeVocabulary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', MongoIdPipe) lessonId: string,
    @Param('vocabularyId', MongoIdPipe) vocabularyId: string,
  ) {
    return this.lessons.completeVocabulary(user.id, lessonId, vocabularyId);
  }

  @Post('lessons/:lessonId/complete')
  completeLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', MongoIdPipe) lessonId: string,
  ) {
    return this.lessons.completeLesson(user.id, lessonId);
  }
}
