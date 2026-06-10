import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OpportunitiesService } from './opportunities.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { VolunteerGuard } from '../common/guards/volunteer.guard';

@ApiTags('opportunities')
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly svc: OpportunitiesService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    return this.svc.findAll(+page, +limit, search);
  }

  @Get('volunteer')
  @UseGuards(VolunteerGuard)
  @ApiBearerAuth()
  findAvailableForVolunteer(
    @Request() request: any,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    return this.svc.findAvailableForVolunteer(
      request.user.sub,
      +page,
      +limit,
      search,
    );
  }

  @Post(':id/join')
  @UseGuards(VolunteerGuard)
  @ApiBearerAuth()
  join(@Request() request: any, @Param('id', ParseIntPipe) id: number) {
    return this.svc.join(id, request.user.sub);
  }

  @Post('admin')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  create(@Body() dto: any) {
    return this.svc.create(dto);
  }

  @Patch('admin/:id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.svc.update(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
