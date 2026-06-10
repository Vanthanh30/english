import { Module } from '@nestjs/common';
import { AuthModule } from './auth.routes';
import { FlashcardController } from '../controllers/flashcard.controller';
import { FlashcardService } from '../services/flashcard.service';
import { FLASHCARD_REPOSITORY } from '../repositories/flashcard.repository';
import { PrismaFlashcardRepository } from '../repositories/prisma-flashcard.repository';

@Module({
  imports: [AuthModule],
  controllers: [FlashcardController],
  providers: [
    FlashcardService,
    {
      provide: FLASHCARD_REPOSITORY,
      useClass: PrismaFlashcardRepository,
    },
  ],
})
export class FlashcardModule {}
