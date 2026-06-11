import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';

export const REQUEST_OUTPUT_DIRECTORY = join(process.cwd(), 'uploads', 'outputs');

mkdirSync(REQUEST_OUTPUT_DIRECTORY, { recursive: true });

const ALLOWED_EXTENSIONS = new Set([
  '.docx',
  '.doc',
  '.mp3',
  '.wav',
  '.ogg',
  '.aac',
  '.m4a',
]);

export const requestOutputUploadOptions = {
  storage: diskStorage({
    destination: REQUEST_OUTPUT_DIRECTORY,
    filename: (
      _request: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const ext = extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024, files: 1 },
  fileFilter: (
    _request: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      callback(
        new BadRequestException(
          'Only Word (.docx, .doc) and audio (.mp3, .wav, .ogg, .aac, .m4a) files are allowed',
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
};
