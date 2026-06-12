import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VisuallyImpairedGuard } from '../common/guards/visually-impaired.guard';
import { CoordinatorGuard } from '../common/guards/coordinator.guard';
import { VolunteerGuard } from '../common/guards/volunteer.guard';
import { UploadedFileCleanupInterceptor } from './uploaded-file-cleanup.interceptor';
import { DocxMergeService } from './docx-merge.service';

@Module({
  imports: [JwtModule],
  controllers: [RequestsController],
  providers: [
    RequestsService,
    AdminGuard,
    JwtAuthGuard,
    VisuallyImpairedGuard,
    CoordinatorGuard,
    VolunteerGuard,
    UploadedFileCleanupInterceptor,
    DocxMergeService,
  ],
})
export class RequestsModule {}
