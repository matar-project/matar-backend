import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { open } from 'fs/promises';
import { extname, join } from 'path';
import { diskStorage } from 'multer';

export const VERIFICATION_REPORT_DIRECTORY = join(
  process.cwd(),
  'uploads',
  'verification-reports',
);

mkdirSync(VERIFICATION_REPORT_DIRECTORY, { recursive: true });

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

export async function validateVerificationReport(file: Express.Multer.File) {
  const extension = extname(file.originalname).toLowerCase();
  const handle = await open(file.path, 'r');
  const header = Buffer.alloc(8);

  try {
    await handle.read(header, 0, header.length, 0);
  } finally {
    await handle.close();
  }

  const isPdf =
    extension === '.pdf' && header.subarray(0, 4).toString() === '%PDF';
  const isJpeg =
    (extension === '.jpg' || extension === '.jpeg') &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff;
  const isPng =
    extension === '.png' &&
    header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  if (!isPdf && !isJpeg && !isPng) {
    throw new BadRequestException(
      'الملف لا يحتوي على بيانات PDF أو JPG أو PNG صالحة',
    );
  }
}

export const verificationReportUploadOptions = {
  storage: diskStorage({
    destination: VERIFICATION_REPORT_DIRECTORY,
    filename: (
      _request: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (
    _request: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      callback(
        new BadRequestException('يُسمح فقط بملفات PDF وJPG وJPEG وPNG'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};
