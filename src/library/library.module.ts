import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule],
  controllers: [LibraryController],
  providers: [LibraryService, AdminGuard, JwtAuthGuard],
})
export class LibraryModule {}
