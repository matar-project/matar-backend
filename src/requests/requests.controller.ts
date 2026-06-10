import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateBookRequestDto } from './dto/create-book-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { AdminGuard } from '../common/guards/admin.guard';
import { VisuallyImpairedGuard } from '../common/guards/visually-impaired.guard';
import { CoordinatorGuard } from '../common/guards/coordinator.guard';
import { VolunteerGuard } from '../common/guards/volunteer.guard';
import {
  AcceptRequestDto,
  RejectRequestDto,
} from './dto/coordinator-action.dto';
import {
  CreateReservationDto,
  RejectReservationDto,
} from './dto/reservation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { requestPdfUploadOptions } from './request-upload.config';
import { UploadedFileCleanupInterceptor } from './uploaded-file-cleanup.interceptor';

interface AuthenticatedRequest {
  user: {
    sub: number;
    role: string;
  };
}

@ApiTags('requests')
@Controller()
export class RequestsController {
  constructor(private readonly svc: RequestsService) {}

  @Post('requests')
  @UseGuards(VisuallyImpairedGuard)
  @UseInterceptors(
    FileInterceptor('pdfFile', requestPdfUploadOptions),
    UploadedFileCleanupInterceptor,
  )
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  createRequest(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateRequestDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.svc.createRequest(request.user.sub, dto, file);
  }

  @Get('requests/:id/pdf')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async downloadRequestPdf(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Res() response: Response,
  ) {
    const file = await this.svc.getRequestPdf(id, request.user);
    response.download(file.path, file.originalName);
  }

  @Post('book-requests')
  @UseGuards(VisuallyImpairedGuard)
  @ApiBearerAuth()
  createBookRequest(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateBookRequestDto,
  ) {
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
  updateRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRequestDto,
  ) {
    return this.svc.updateRequest(id, dto);
  }

  @Patch('admin/book-requests/:id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  updateBookRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRequestDto,
  ) {
    return this.svc.updateBookRequest(id, dto);
  }

  @Get('coordinator/requests')
  @UseGuards(CoordinatorGuard)
  @ApiBearerAuth()
  getCoordinatorRequests(@Query('status') status?: string) {
    return this.svc.getCoordinatorRequests(status);
  }

  @Patch('coordinator/requests/:id/accept')
  @UseGuards(CoordinatorGuard)
  @ApiBearerAuth()
  acceptRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AcceptRequestDto,
  ) {
    return this.svc.acceptRequest(id, request.user.sub, dto.notes);
  }

  @Patch('coordinator/requests/:id/reject')
  @UseGuards(CoordinatorGuard)
  @ApiBearerAuth()
  rejectRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectRequestDto,
  ) {
    return this.svc.rejectRequest(id, request.user.sub, dto.reason);
  }

  @Get('coordinator/requests/:id/reservations')
  @UseGuards(CoordinatorGuard)
  @ApiBearerAuth()
  getRequestReservations(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getRequestReservations(id);
  }

  @Get('coordinator/reservations')
  @UseGuards(CoordinatorGuard)
  @ApiBearerAuth()
  getCoordinatorReservations(@Query('status') status?: string) {
    return this.svc.getCoordinatorReservations(status);
  }

  @Get('coordinator/stats')
  @UseGuards(CoordinatorGuard)
  @ApiBearerAuth()
  getCoordinatorStats() {
    return this.svc.getCoordinatorStats();
  }

  @Get('volunteer/available-requests')
  @UseGuards(VolunteerGuard)
  @ApiBearerAuth()
  getAvailableRequests() {
    return this.svc.getAvailableRequests();
  }

  @Post('volunteer/requests/:requestId/reservations')
  @UseGuards(VolunteerGuard)
  @ApiBearerAuth()
  createReservation(
    @Req() request: AuthenticatedRequest,
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() dto: CreateReservationDto,
  ) {
    return this.svc.createReservation(requestId, request.user.sub, dto);
  }

  @Get('volunteer/my-reservations')
  @UseGuards(VolunteerGuard)
  @ApiBearerAuth()
  getMyReservations(@Req() request: AuthenticatedRequest) {
    return this.svc.getMyReservations(request.user.sub);
  }

  @Patch('volunteer/reservations/:id/done')
  @UseGuards(VolunteerGuard)
  @ApiBearerAuth()
  completeReservation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.completeReservation(id, request.user.sub);
  }

  @Patch('volunteer/reservations/:id/reject')
  @UseGuards(VolunteerGuard)
  @ApiBearerAuth()
  rejectReservation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectReservationDto,
  ) {
    return this.svc.rejectReservation(id, request.user.sub, dto.reason);
  }

  @Get('stats')
  getStats() {
    return this.svc.getStats();
  }
}
