import { Module } from '@nestjs/common';
import { AuthModule } from './auth.routes';
import { FlashcardModule } from './flashcard.routes';
import { VisionController } from '../controllers/vision.controller';
import { VisionService } from '../services/vision.service';
import { VISION_REPOSITORY } from '../repositories/vision.repository';
import { PrismaVisionRepository } from '../repositories/prisma-vision.repository';
import { CloudinaryImageService } from '../configs/cloudinary';

@Module({
  imports: [AuthModule, FlashcardModule],
  controllers: [VisionController],
  providers: [
    VisionService,
    CloudinaryImageService,
    {
      provide: VISION_REPOSITORY,
      useClass: PrismaVisionRepository,
    },
  ],
})
export class VisionModule {}
