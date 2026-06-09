import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService, AdminGuard, JwtAuthGuard],
})
export class OpportunitiesModule {}
