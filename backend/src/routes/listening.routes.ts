import { Module } from '@nestjs/common';
import { AuthModule } from './auth.routes';
import { AdminListeningController } from '../controllers/admin-listening.controller';
import { ListeningController } from '../controllers/listening.controller';
import { ListeningService } from '../services/listening.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminListeningController, ListeningController],
  providers: [ListeningService],
  exports: [ListeningService],
})
export class ListeningModule {}
