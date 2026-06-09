import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VisuallyImpairedGuard } from '../common/guards/visually-impaired.guard';

@Module({
  imports: [JwtModule],
  controllers: [RequestsController],
  providers: [RequestsService, AdminGuard, JwtAuthGuard, VisuallyImpairedGuard],
})
export class RequestsModule {}
