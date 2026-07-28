import { Module } from '@nestjs/common';
import { AuthModule } from './auth.routes';
import { FlashcardModule } from './flashcard.routes';
import { ImageWritingController } from '../controllers/image-writing.controller';
import { ImageWritingService } from '../services/image-writing.service';
import { IMAGE_WRITING_REPOSITORY } from '../repositories/image-writing.repository';
import { PrismaImageWritingRepository } from '../repositories/prisma-image-writing.repository';
import { CloudinaryImageService } from '../configs/cloudinary';

@Module({
  imports: [AuthModule, FlashcardModule],
  controllers: [ImageWritingController],
  providers: [
    ImageWritingService,
    CloudinaryImageService,
    {
      provide: IMAGE_WRITING_REPOSITORY,
      useClass: PrismaImageWritingRepository,
    },
  ],
})
export class ImageWritingModule {}
