import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VolunteersService } from './volunteers.service';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('volunteers')
@Controller('volunteers')
export class VolunteersController {
  constructor(private readonly svc: VolunteersService) {}

  @Get()
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    return this.svc.findAll(+page, +limit, search);
  }
}
