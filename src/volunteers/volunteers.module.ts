import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VolunteerGuard } from '../common/guards/volunteer.guard';

@Module({
  imports: [JwtModule],
  controllers: [VolunteersController],
  providers: [VolunteersService, AdminGuard, JwtAuthGuard, VolunteerGuard],
})
export class VolunteersModule {}
