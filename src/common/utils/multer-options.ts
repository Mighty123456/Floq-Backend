import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';

export const multerOptions = {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|mp4|mov|quicktime)$/)) {
      cb(null, true);
    } else {
      cb(new BadRequestException(`Unsupported file type ${file.mimetype}`), false);
    }
  },
};

export const avatarMulterOptions = {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req: any, file: any, cb: any) => {
      if (file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`Unsupported file type ${file.mimetype}`), false);
      }
    },
};
