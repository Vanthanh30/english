import { Module } from '@nestjs/common';
import { AuthModule } from './auth.routes';
import { FlashcardModule } from './flashcard.routes';
import { ReadingController } from '../controllers/reading.controller';
import { DictionaryController } from '../controllers/dictionary.controller';
import { ReadingService } from '../services/reading.service';
import { READING_REPOSITORY } from '../repositories/reading.repository';
import { PrismaReadingRepository } from '../repositories/prisma-reading.repository';

@Module({
  imports: [AuthModule, FlashcardModule],
  controllers: [ReadingController, DictionaryController],
  providers: [
    ReadingService,
    {
      provide: READING_REPOSITORY,
      useClass: PrismaReadingRepository,
    },
  ],
  exports: [ReadingService, READING_REPOSITORY],
})
export class ReadingModule {}
