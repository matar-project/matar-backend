import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';

export const RESERVATION_OUTPUT_DIRECTORY = join(
  process.cwd(),
  'uploads',
  'reservation-outputs',
);

mkdirSync(RESERVATION_OUTPUT_DIRECTORY, { recursive: true });

export const reservationOutputUploadOptions = {
  storage: diskStorage({
    destination: RESERVATION_OUTPUT_DIRECTORY,
    filename: (
      _request: Express.Request,
      _file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => callback(null, `${randomUUID()}.docx`),
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (
    _request: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (extname(file.originalname).toLowerCase() !== '.docx') {
      callback(new BadRequestException('A Word .docx file is required'), false);
      return;
    }
    callback(null, true);
  },
};
