import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateBookRequestDto } from './dto/create-book-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { AdminGuard } from '../common/guards/admin.guard';
import { VisuallyImpairedGuard } from '../common/guards/visually-impaired.guard';

@ApiTags('requests')
@Controller()
export class RequestsController {
  constructor(private readonly svc: RequestsService) {}

  @Post('requests')
  @UseGuards(VisuallyImpairedGuard)
  @ApiBearerAuth()
  createRequest(@Req() request: any, @Body() dto: CreateRequestDto) {
    return this.svc.createRequest(request.user.sub, dto);
  }

  @Post('book-requests')
  @UseGuards(VisuallyImpairedGuard)
  @ApiBearerAuth()
  createBookRequest(@Req() request: any, @Body() dto: CreateBookRequestDto) {
    return this.svc.createBookRequest(request.user.sub, dto);
  }

  @Get('admin/requests')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  findAllRequests(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.svc.findAllRequests(+page, +limit, status);
  }

  @Get('admin/book-requests')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  findAllBookRequests(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.svc.findAllBookRequests(+page, +limit, status);
  }

  @Patch('admin/requests/:id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  updateRequest(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRequestDto) {
    return this.svc.updateRequest(id, dto);
  }

  @Patch('admin/book-requests/:id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  updateBookRequest(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRequestDto) {
    return this.svc.updateBookRequest(id, dto);
  }

  @Get('stats')
  getStats() {
    return this.svc.getStats();
  }
}
