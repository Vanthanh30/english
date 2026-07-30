import { Module } from '@nestjs/common';
import { AuthModule } from './auth.routes';
import { AdminListeningController } from '../controllers/admin-listening.controller';
import { ListeningController } from '../controllers/listening.controller';
import { ListeningService } from '../services/listening.service';
import { CloudinaryImageService } from '../configs/cloudinary';

@Module({
  imports: [AuthModule],
  controllers: [AdminListeningController, ListeningController],
  providers: [ListeningService, CloudinaryImageService],
  exports: [ListeningService],
})
export class ListeningModule {}
