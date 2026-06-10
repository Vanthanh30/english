import {
  Controller,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../middlewares/decorators/roles.decorator';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import { RolesGuard } from '../middlewares/admin.middleware';
import { CloudinaryImageService } from '../configs/cloudinary';

@Controller('admin/uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminUploadController {
  constructor(private readonly images: CloudinaryImageService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5_000_000 } }))
  uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: 5_000_000 })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    return this.images.upload(file.buffer);
  }
}
