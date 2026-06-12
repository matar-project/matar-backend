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
import { UpdateRequestDto } from './dto/update-request.dto';
import { AdminGuard } from '../common/guards/admin.guard';
import { VisuallyImpairedGuard } from '../common/guards/visually-impaired.guard';
import { CoordinatorGuard } from '../common/guards/coordinator.guard';
import { VolunteerGuard } from '../common/guards/volunteer.guard';
import {
  AcceptRequestDto,
  RejectRequestDto,
  UpdateCoordinatorRequestDto,
} from './dto/coordinator-action.dto';
import {
  CreateReservationDto,
  RejectReservationDto,
} from './dto/reservation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { requestOutputUploadOptions } from './request-output-upload.config';
import { requestPdfUploadOptions } from './request-upload.config';
import { UploadedFileCleanupInterceptor } from './uploaded-file-cleanup.interceptor';
import { reservationOutputUploadOptions } from './reservation-output-upload.config';

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

  @Get('requests/my')
  @UseGuards(VisuallyImpairedGuard)
  @ApiBearerAuth()
  getMyRequests(
    @Req() request: AuthenticatedRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.svc.getMyRequests(request.user.sub, +page, +limit);
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

  @Get('admin/requests')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  findAllRequests(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.findAllRequests(+page, +limit, status, search);
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

  @Get('coordinator/requests')
  @UseGuards(CoordinatorGuard)
  @ApiBearerAuth()
  getCoordinatorRequests(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    return this.svc.getCoordinatorRequests(status, +page, +limit, search);
  }

  @Patch('coordinator/requests/:id')
  @UseGuards(CoordinatorGuard)
  @ApiBearerAuth()
  updateCoordinatorRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCoordinatorRequestDto,
  ) {
    return this.svc.updateCoordinatorRequest(id, dto);
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

  @Patch('coordinator/requests/:id/approve-completion')
  @UseGuards(CoordinatorGuard)
  @ApiBearerAuth()
  approveRequestCompletion(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.approveRequestCompletion(id, request.user.sub);
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
  getCoordinatorReservations(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    return this.svc.getCoordinatorReservations(
      status,
      +page,
      +limit,
      search,
    );
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
  getAvailableRequests(
    @Req() request: AuthenticatedRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    return this.svc.getAvailableRequests(
      request.user.sub,
      +page,
      +limit,
      search,
    );
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

  @Post('volunteer/requests/:requestId/claim')
  @UseGuards(VolunteerGuard)
  @ApiBearerAuth()
  claimAccompanimentRequest(
    @Req() request: AuthenticatedRequest,
    @Param('requestId', ParseIntPipe) requestId: number,
  ) {
    return this.svc.claimAccompanimentRequest(requestId, request.user.sub);
  }

  @Get('volunteer/my-accompaniment-requests')
  @UseGuards(VolunteerGuard)
  @ApiBearerAuth()
  getMyAccompanimentRequests(
    @Req() request: AuthenticatedRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    return this.svc.getMyAccompanimentRequests(
      request.user.sub,
      +page,
      +limit,
      search,
    );
  }

  @Get('volunteer/my-reservations')
  @UseGuards(VolunteerGuard)
  @ApiBearerAuth()
  getMyReservations(
    @Req() request: AuthenticatedRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    return this.svc.getMyReservations(
      request.user.sub,
      +page,
      +limit,
      search,
    );
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

  @Get('volunteer/dashboard')
  @UseGuards(VolunteerGuard)
  @ApiBearerAuth()
  getVolunteerDashboard(@Req() request: AuthenticatedRequest) {
    return this.svc.getVolunteerDashboard(request.user.sub);
  }

  @Post('volunteer/reservations/:id/word-output')
  @UseGuards(VolunteerGuard)
  @UseInterceptors(
    FileInterceptor('outputFile', reservationOutputUploadOptions),
    UploadedFileCleanupInterceptor,
  )
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  completeWordReservation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.completeWordReservation(id, request.user.sub, file);
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

  @Post('coordinator/requests/:id/output')
  @UseGuards(CoordinatorGuard)
  @UseInterceptors(
    FileInterceptor('outputFile', requestOutputUploadOptions),
    UploadedFileCleanupInterceptor,
  )
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  uploadOutputFile(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.uploadOutputFile(id, request.user.sub, file);
  }

  @Get('requests/:id/output')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async downloadOutputFile(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Res() response: Response,
  ) {
    const file = await this.svc.downloadOutputFile(id, request.user);
    response.download(file.path, file.originalName);
  }

  @Get('stats')
  getStats() {
    return this.svc.getStats();
  }
}
