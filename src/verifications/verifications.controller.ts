import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { verificationReportUploadOptions } from '../auth/verification-report-upload.config';
import { UploadedFileCleanupInterceptor } from '../requests/uploaded-file-cleanup.interceptor';
import { RejectVerificationDto } from './dto/reject-verification.dto';
import { VerificationsService } from './verifications.service';

@Controller()
export class VerificationsController {
  constructor(private readonly service: VerificationsService) {}

  @Get('admin/verifications/pending')
  @UseGuards(AdminGuard)
  pending() {
    return this.service.pending();
  }

  @Get('admin/verifications/:documentId/report')
  @UseGuards(AdminGuard)
  async report(
    @Param('documentId', ParseIntPipe) documentId: number,
    @Res() response: Response,
  ) {
    const file = await this.service.getReport(documentId);
    response.download(file.path, file.originalName);
  }

  @Patch('admin/verifications/:documentId/approve')
  @UseGuards(AdminGuard)
  approve(
    @Req() request: any,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    return this.service.approve(documentId, request.user.sub);
  }

  @Patch('admin/verifications/:documentId/reject')
  @UseGuards(AdminGuard)
  reject(
    @Req() request: any,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Body() dto: RejectVerificationDto,
  ) {
    return this.service.reject(documentId, request.user.sub, dto.reason);
  }

  @Post('verification-documents/reupload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('healthReport', verificationReportUploadOptions),
    UploadedFileCleanupInterceptor,
  )
  reupload(@Req() request: any, @UploadedFile() file?: Express.Multer.File) {
    return this.service.reupload(request.user.sub, file);
  }
}
