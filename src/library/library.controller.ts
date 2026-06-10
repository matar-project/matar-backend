import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LibraryService } from './library.service';
import { CreateLibraryItemDto } from './dto/create-library-item.dto';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('library')
@Controller('library')
export class LibraryController {
  constructor(private readonly svc: LibraryService) {}

  @Get('books')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findCompletedBooks(
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.svc.findCompletedBooks(search, +page, +limit);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findAll(
    @Query('search') search?: string,
    @Query('author') author?: string,
    @Query('subject') subject?: string,
    @Query('curriculum') curriculum?: string,
    @Query('country') country?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.svc.findAll(search, author, subject, curriculum, country, +page, +limit);
  }

  @Get('admin/all')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  findAllAdmin(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    return this.svc.findAllAdmin(+page, +limit, search);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

  @Post('admin')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  create(@Body() dto: CreateLibraryItemDto) {
    return this.svc.create(dto);
  }

  @Patch('admin/:id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateLibraryItemDto>) {
    return this.svc.update(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
