import { Module } from '@nestjs/common';
import { AuthModule } from './auth.routes';
import { LessonController } from '../controllers/lesson.controller';
import { LessonService } from '../services/lesson.service';
import { LEARNING_REPOSITORY } from '../repositories/learning.repository';
import { PrismaLearningRepository } from '../repositories/prisma-learning.repository';

@Module({
  imports: [AuthModule],
  controllers: [LessonController],
  providers: [
    LessonService,
    {
      provide: LEARNING_REPOSITORY,
      useClass: PrismaLearningRepository,
    },
  ],
})
export class LessonModule {}
