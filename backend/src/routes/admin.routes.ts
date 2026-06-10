import { Module } from '@nestjs/common';
import { AuthModule } from './auth.routes';
import { ContentService } from '../services/content.service';
import { CONTENT_REPOSITORY } from '../repositories/content.repository';
import { CloudinaryImageService } from '../configs/cloudinary';
import { PrismaContentRepository } from '../repositories/prisma-content.repository';
import { AdminContentController } from '../controllers/admin.controller';
import { AdminUploadController } from '../controllers/image.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminContentController, AdminUploadController],
  providers: [
    ContentService,
    CloudinaryImageService,
    {
      provide: CONTENT_REPOSITORY,
      useClass: PrismaContentRepository,
    },
  ],
})
export class ContentModule {}
