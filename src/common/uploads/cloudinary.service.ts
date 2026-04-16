import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  UploadApiErrorResponse,
  UploadApiOptions,
  UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary';
import streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  private ensureCloudinaryConfig() {
    const requiredKeys = [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ];
    const missing = requiredKeys.filter((key) => !process.env[key]?.trim());

    if (missing.length) {
      throw new ServiceUnavailableException(
        `Cloudinary sozlanmagan. Yetishmayotgan env: ${missing.join(', ')}`,
      );
    }
  }

  uploadFile(
    file: Express.Multer.File,
    options: UploadApiOptions = {},
  ): Promise<UploadApiResponse> {
    this.ensureCloudinaryConfig();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          timeout: 30_000,
          ...options,
        },
        (
          error: UploadApiErrorResponse | undefined,
          result?: UploadApiResponse,
        ) => {
          if (error) {
            const message =
              error.message || 'Cloudinaryga yuklash vaqtida xatolik.';
            const httpCode = Number(error.http_code ?? 0);

            if (httpCode >= 400 && httpCode < 500) {
              return reject(new BadRequestException(message));
            }

            return reject(
              new ServiceUnavailableException(message),
            );
          }

          if (!result) {
            return reject(
              new ServiceUnavailableException(
                'Cloudinary javobi olinmadi. Qayta urinib koring.',
              ),
            );
          }

          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}
