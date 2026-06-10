import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { existsSync, unlinkSync } from 'fs';
import { catchError, Observable } from 'rxjs';

type RequestWithFile = Request & { file?: Express.Multer.File };

@Injectable()
export class UploadedFileCleanupInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithFile>();

    return next.handle().pipe(
      catchError((error: unknown) => {
        if (request.file?.path && existsSync(request.file.path)) {
          unlinkSync(request.file.path);
        }
        throw error;
      }),
    );
  }
}
