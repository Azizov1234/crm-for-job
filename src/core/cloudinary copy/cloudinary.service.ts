import { Injectable } from '@nestjs/common';
import cloudinary from './cloudinary.config';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  async uploadFile(file: Express.Multer.File): Promise<string> {
    if (file.mimetype.startsWith('video/')) {
      return this.uploadVideo(file);
    }
    return this.uploadImage(file);
  }

  private uploadImage(file: Express.Multer.File): Promise<string> {
    return new Promise((res, rej) => {
      cloudinary.uploader
        .upload_stream(
          { folder: 'user', resource_type: 'image' },
          (
            error: UploadApiErrorResponse | undefined,
            result: UploadApiResponse | undefined,
          ) => {
            if (error) return rej(error);
            if (!result)
              return rej(new Error('Upload failed: Result is undefined'));
            res(result.secure_url);
          },
        )
        .end(file.buffer);
    });
  }

  private uploadVideo(file: Express.Multer.File): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'video', folder: 'user' },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error) return reject(error);
          if (!result)
            return reject(new Error('Upload failed: Result is undefined'));
          resolve(result.secure_url);
        },
      );

      stream.end(file.buffer);
    });
  }
}
