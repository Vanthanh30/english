import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { Readable } from 'node:stream';

export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

@Injectable()
export class CloudinaryImageService {
  constructor(config: ConfigService) {
    cloudinary.config({
      cloud_name: config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: config.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  upload(buffer: Buffer): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'english-quest/content',
          resource_type: 'image',
          unique_filename: true,
          overwrite: false,
          transformation: [
            { width: 1600, height: 1600, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error || !result) {
            reject(
              error instanceof Error
                ? error
                : new Error('Cloudinary upload failed'),
            );
            return;
          }
          resolve(this.toUploadedImage(result));
        },
      );

      Readable.from(buffer).pipe(stream);
    });
  }

  async delete(publicId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  private toUploadedImage(result: UploadApiResponse): UploadedImage {
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  }
}
