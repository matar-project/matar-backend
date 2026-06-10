import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VolunteersService } from './volunteers.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { AdminGuard } from '../common/guards/admin.guard';
import { VolunteerGuard } from '../common/guards/volunteer.guard';

@ApiTags('volunteers')
@Controller('volunteers')
export class VolunteersController {
  constructor(private readonly svc: VolunteersService) {}

  @Post()
  @UseGuards(VolunteerGuard)
  @ApiBearerAuth()
  create(@Request() request: any, @Body() dto: CreateVolunteerDto) {
    return this.svc.create(request.user.sub, dto);
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.svc.findAll(+page, +limit);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { contacted?: boolean; notes?: string },
  ) {
    return this.svc.update(id, dto);
  }
}
