import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';

export const REQUEST_PDF_DIRECTORY = join(process.cwd(), 'uploads', 'requests');

mkdirSync(REQUEST_PDF_DIRECTORY, { recursive: true });

export const requestPdfUploadOptions = {
  storage: diskStorage({
    destination: REQUEST_PDF_DIRECTORY,
    filename: (
      _request: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      callback(null, `${randomUUID()}.pdf`);
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (
    _request: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const isPdf =
      file.mimetype === 'application/pdf' &&
      extname(file.originalname).toLowerCase() === '.pdf';

    if (!isPdf) {
      callback(new BadRequestException('Only PDF files are allowed'), false);
      return;
    }

    callback(null, true);
  },
};
