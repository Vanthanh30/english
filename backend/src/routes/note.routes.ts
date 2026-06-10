import { Module } from '@nestjs/common';
import { AuthModule } from './auth.routes';
import { NoteController } from '../controllers/note.controller';
import { NoteService } from '../services/note.service';
import { NOTE_REPOSITORY } from '../repositories/note.repository';
import { PrismaNoteRepository } from '../repositories/prisma-note.repository';

@Module({
  imports: [AuthModule],
  controllers: [NoteController],
  providers: [
    NoteService,
    {
      provide: NOTE_REPOSITORY,
      useClass: PrismaNoteRepository,
    },
  ],
})
export class NoteModule {}
