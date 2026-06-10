import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { open, unlink } from 'fs/promises';
import { basename, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateBookRequestDto } from './dto/create-book-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { CreateReservationDto } from './dto/reservation.dto';
import {
  Prisma,
  RequestStatus,
  RequestType,
  ReservationStatus,
} from '../generated/prisma/client';
import { REQUEST_PDF_DIRECTORY } from './request-upload.config';

const COORDINATOR_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING_COORDINATOR,
  RequestStatus.COORDINATOR_ACCEPTED,
  RequestStatus.COORDINATOR_REJECTED,
];

const RESERVABLE_TYPES: RequestType[] = [
  RequestType.PDF_TO_WORD,
  RequestType.PDF_TO_AUDIO,
];

type ReservationWithRelations = Prisma.PageReservationGetPayload<{
  include: {
    volunteer: { select: { id: true; name: true; email: true; phone: true } };
    request: {
      select: {
        id: true;
        title: true;
        requestType: true;
        totalPages: true;
      };
    };
  };
}>;

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createRequest(
    userId: number,
    dto: CreateRequestDto,
    file?: Express.Multer.File,
  ) {
    this.logger.log('Creating service request');
    try {
      const isPdfRequest = RESERVABLE_TYPES.includes(dto.requestType);
      if (isPdfRequest && !file) {
        throw new BadRequestException(
          'A PDF file is required for this request type',
        );
      }
      if (!isPdfRequest && file) {
        throw new BadRequestException(
          'Accompaniment requests do not accept PDF files',
        );
      }
      if (file) await this.validatePdfSignature(file.path);

      const contact = await this.getUserContact(userId);
      const request = await this.prisma.request.create({
        data: {
          ...dto,
          ...contact,
          createdByUserId: userId,
          status: RequestStatus.PENDING_COORDINATOR,
          pdfOriginalName: file
            ? this.normalizeOriginalFileName(file.originalname)
            : undefined,
          pdfStoredName: file?.filename,
          pdfMimeType: file?.mimetype,
          pdfFileSize: file?.size,
        },
      });
      this.logger.log(`Service request created: id=${request.id}`);
      return request;
    } catch (error) {
      if (file) await unlink(file.path).catch(() => undefined);
      throw error;
    }
  }

  async getRequestPdf(requestId: number, user: { sub: number; role: string }) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: {
        createdByUserId: true,
        requestType: true,
        status: true,
        pdfOriginalName: true,
        pdfStoredName: true,
      },
    });

    if (!request) throw new NotFoundException('Request not found');

    const isOwner =
      user.role === 'visually_impired' && request.createdByUserId === user.sub;
    const isCoordinator = user.role === 'coordinator';
    const isAvailableToVolunteer =
      user.role === 'volunteer' &&
      request.status === RequestStatus.COORDINATOR_ACCEPTED &&
      RESERVABLE_TYPES.includes(request.requestType);

    if (!isOwner && !isCoordinator && !isAvailableToVolunteer) {
      throw new ForbiddenException('You do not have access to this PDF file');
    }
    if (!request.pdfStoredName || !request.pdfOriginalName) {
      throw new NotFoundException('PDF file not found');
    }

    const storedName = basename(request.pdfStoredName);
    const path = join(REQUEST_PDF_DIRECTORY, storedName);
    if (!existsSync(path)) throw new NotFoundException('PDF file not found');

    return {
      path,
      originalName: request.pdfOriginalName,
    };
  }

  async createBookRequest(userId: number, dto: CreateBookRequestDto) {
    this.logger.log('Creating book request');
    const contact = await this.getUserContact(userId);
    const request = await this.prisma.bookRequest.create({
      data: { ...dto, ...contact },
    });
    this.logger.log(`Book request created: id=${request.id}`);
    return request;
  }

  async findAllRequests(page = 1, limit = 20, status?: string) {
    this.logger.log(
      `Listing service requests: page=${page} limit=${limit} status=${status ?? 'all'}`,
    );
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};
    const [data, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.request.count({ where }),
    ]);
    this.logger.log(`Service requests fetched: total=${total}`);
    return { data, total, page, limit };
  }

  async findAllBookRequests(page = 1, limit = 20, status?: string) {
    this.logger.log(
      `Listing book requests: page=${page} limit=${limit} status=${status ?? 'all'}`,
    );
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};
    const [data, total] = await Promise.all([
      this.prisma.bookRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.bookRequest.count({ where }),
    ]);
    this.logger.log(`Book requests fetched: total=${total}`);
    return { data, total, page, limit };
  }

  async updateRequest(id: number, dto: UpdateRequestDto) {
    this.logger.log(`Updating service request id=${id}`);
    const exists = await this.prisma.request.findUnique({ where: { id } });
    if (!exists) {
      this.logger.warn(`Service request not found: id=${id}`);
      throw new NotFoundException('Request not found');
    }
    const updated = await this.prisma.request.update({
      where: { id },
      data: dto as any,
    });
    this.logger.log(
      `Service request updated: id=${id} status=${(updated as any).status ?? 'unchanged'}`,
    );
    return updated;
  }

  async updateBookRequest(id: number, dto: UpdateRequestDto) {
    this.logger.log(`Updating book request id=${id}`);
    const exists = await this.prisma.bookRequest.findUnique({ where: { id } });
    if (!exists) {
      this.logger.warn(`Book request not found: id=${id}`);
      throw new NotFoundException('Book request not found');
    }
    const updated = await this.prisma.bookRequest.update({
      where: { id },
      data: dto as any,
    });
    this.logger.log(`Book request updated: id=${id}`);
    return updated;
  }

  async getCoordinatorRequests(status?: string) {
    const parsedStatus = this.parseRequestStatus(status);
    return this.prisma.request.findMany({
      where: {
        status: parsedStatus ? parsedStatus : { in: COORDINATOR_STATUSES },
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            country: true,
            city: true,
          },
        },
        coordinator: {
          select: { id: true, name: true },
        },
        _count: { select: { reservations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptRequest(id: number, coordinatorId: number, notes?: string) {
    await this.requirePendingRequest(id);
    return this.prisma.request.update({
      where: { id },
      data: {
        status: RequestStatus.COORDINATOR_ACCEPTED,
        coordinatorId,
        coordinatorNotes: notes?.trim() || null,
      },
    });
  }

  async rejectRequest(id: number, coordinatorId: number, reason: string) {
    await this.requirePendingRequest(id);
    return this.prisma.request.update({
      where: { id },
      data: {
        status: RequestStatus.COORDINATOR_REJECTED,
        coordinatorId,
        coordinatorNotes: reason.trim(),
      },
    });
  }

  async getRequestReservations(requestId: number) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true },
    });
    if (!request) throw new NotFoundException('Request not found');

    const reservations = await this.prisma.pageReservation.findMany({
      where: { requestId },
      include: this.reservationRelations(),
      orderBy: { createdAt: 'desc' },
    });
    return reservations.map((reservation) =>
      this.withEffectiveStatus(reservation),
    );
  }

  async getCoordinatorReservations(status?: string) {
    const parsedStatus = this.parseReservationStatus(status);
    const reservations = await this.prisma.pageReservation.findMany({
      where:
        parsedStatus === ReservationStatus.LATE
          ? {
              status: ReservationStatus.IN_PROGRESS,
              deadlineAt: { lt: new Date() },
            }
          : parsedStatus
            ? { status: parsedStatus }
            : undefined,
      include: this.reservationRelations(),
      orderBy: { createdAt: 'desc' },
    });

    const withStatus = reservations.map((reservation) =>
      this.withEffectiveStatus(reservation),
    );
    return parsedStatus
      ? withStatus.filter(
          (reservation) => reservation.effectiveStatus === parsedStatus,
        )
      : withStatus;
  }

  async getCoordinatorStats() {
    const now = new Date();
    const [
      pendingRequests,
      acceptedRequests,
      rejectedRequests,
      inProgressReservations,
      doneReservations,
      lateReservations,
    ] = await Promise.all([
      this.prisma.request.count({
        where: { status: RequestStatus.PENDING_COORDINATOR },
      }),
      this.prisma.request.count({
        where: { status: RequestStatus.COORDINATOR_ACCEPTED },
      }),
      this.prisma.request.count({
        where: { status: RequestStatus.COORDINATOR_REJECTED },
      }),
      this.prisma.pageReservation.count({
        where: {
          status: ReservationStatus.IN_PROGRESS,
          deadlineAt: { gte: now },
        },
      }),
      this.prisma.pageReservation.count({
        where: { status: ReservationStatus.DONE },
      }),
      this.prisma.pageReservation.count({
        where: {
          status: ReservationStatus.IN_PROGRESS,
          deadlineAt: { lt: now },
        },
      }),
    ]);

    return {
      pendingRequests,
      acceptedRequests,
      rejectedRequests,
      inProgressReservations,
      doneReservations,
      lateReservations,
    };
  }

  async getAvailableRequests() {
    const requests = await this.prisma.request.findMany({
      where: {
        status: RequestStatus.COORDINATOR_ACCEPTED,
        requestType: { in: RESERVABLE_TYPES },
        totalPages: { not: null },
      },
      include: {
        reservations: {
          where: { status: { not: ReservationStatus.REJECTED } },
          select: {
            id: true,
            startPage: true,
            endPage: true,
            status: true,
            deadlineAt: true,
          },
          orderBy: { startPage: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => ({
      ...request,
      reservedRanges: request.reservations.map((reservation) => ({
        ...reservation,
        effectiveStatus: this.getEffectiveStatus(reservation),
      })),
    }));
  }

  async createReservation(
    requestId: number,
    volunteerId: number,
    dto: CreateReservationDto,
  ) {
    if (dto.endPage < dto.startPage) {
      throw new BadRequestException(
        'End page must be greater than or equal to start page',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const request = await tx.request.findUnique({
            where: { id: requestId },
            select: {
              id: true,
              status: true,
              requestType: true,
              totalPages: true,
            },
          });

          if (!request) throw new NotFoundException('Request not found');
          if (request.status !== RequestStatus.COORDINATOR_ACCEPTED) {
            throw new BadRequestException(
              'Request is not available for reservation',
            );
          }
          if (!RESERVABLE_TYPES.includes(request.requestType)) {
            throw new BadRequestException(
              'This request type does not support page reservations',
            );
          }
          if (!request.totalPages || dto.endPage > request.totalPages) {
            throw new BadRequestException(
              'Page range exceeds the request total pages',
            );
          }

          const overlap = await tx.pageReservation.findFirst({
            where: {
              requestId,
              status: { not: ReservationStatus.REJECTED },
              startPage: { lte: dto.endPage },
              endPage: { gte: dto.startPage },
            },
            select: { id: true },
          });
          if (overlap) {
            throw new ConflictException(
              'The selected page range is already reserved',
            );
          }

          return tx.pageReservation.create({
            data: {
              requestId,
              volunteerId,
              startPage: dto.startPage,
              endPage: dto.endPage,
              deadlineAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            },
            include: this.reservationRelations(),
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2004', 'P2034'].includes(error.code)
      ) {
        throw new ConflictException(
          'The selected page range is already reserved',
        );
      }
      throw error;
    }
  }

  async getMyReservations(volunteerId: number) {
    const reservations = await this.prisma.pageReservation.findMany({
      where: { volunteerId },
      include: this.reservationRelations(),
      orderBy: { createdAt: 'desc' },
    });
    return reservations.map((reservation) =>
      this.withEffectiveStatus(reservation),
    );
  }

  async completeReservation(id: number, volunteerId: number) {
    const reservation = await this.requireOwnedActiveReservation(
      id,
      volunteerId,
    );
    if (this.getEffectiveStatus(reservation) === ReservationStatus.LATE) {
      throw new BadRequestException(
        'Late reservations cannot be marked as done',
      );
    }
    return this.prisma.pageReservation.update({
      where: { id },
      data: {
        status: ReservationStatus.DONE,
        completedAt: new Date(),
      },
    });
  }

  async rejectReservation(id: number, volunteerId: number, reason?: string) {
    await this.requireOwnedActiveReservation(id, volunteerId);
    return this.prisma.pageReservation.update({
      where: { id },
      data: {
        status: ReservationStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason?.trim() || null,
      },
    });
  }

  async getStats() {
    this.logger.log('Fetching dashboard stats');
    const [
      totalVolunteers,
      totalRequests,
      completedRequests,
      bookRequests,
      libraryItems,
      opportunities,
    ] = await Promise.all([
      this.prisma.volunteer.count(),
      this.prisma.request.count(),
      this.prisma.request.count({ where: { status: 'COMPLETED' as any } }),
      this.prisma.bookRequest.count(),
      this.prisma.libraryItem.count(),
      this.prisma.opportunity.count({ where: { status: 'AVAILABLE' as any } }),
    ]);
    const stats = {
      totalVolunteers,
      totalRequests: totalRequests + bookRequests,
      completedRequests,
      libraryItems,
      opportunities,
    };
    this.logger.log(`Stats: ${JSON.stringify(stats)}`);
    return stats;
  }

  private async getUserContact(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        phone: true,
        country: true,
        city: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.phone || !user.country || !user.city) {
      throw new BadRequestException(
        'Complete your country, city, and phone number before creating a request',
      );
    }

    return {
      fullName: user.name,
      email: user.email,
      phone: user.phone,
      country: user.country,
      city: user.city,
    };
  }

  private async validatePdfSignature(path: string) {
    const file = await open(path, 'r');
    try {
      const signature = Buffer.alloc(5);
      await file.read(signature, 0, signature.length, 0);
      if (signature.toString('ascii') !== '%PDF-') {
        throw new BadRequestException('The uploaded file is not a valid PDF');
      }
    } finally {
      await file.close();
    }
  }

  private normalizeOriginalFileName(fileName: string) {
    if ([...fileName].some((character) => character.charCodeAt(0) > 255)) {
      return fileName;
    }

    const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
    return decoded.includes('\uFFFD') ? fileName : decoded;
  }

  private async requirePendingRequest(id: number) {
    const request = await this.prisma.request.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== RequestStatus.PENDING_COORDINATOR) {
      throw new BadRequestException('Only pending requests can be reviewed');
    }
    return request;
  }

  private async requireOwnedActiveReservation(id: number, volunteerId: number) {
    const reservation = await this.prisma.pageReservation.findUnique({
      where: { id },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.volunteerId !== volunteerId) {
      throw new ForbiddenException('You can only update your own reservations');
    }
    if (reservation.status !== ReservationStatus.IN_PROGRESS) {
      throw new BadRequestException('Reservation is no longer in progress');
    }
    return reservation;
  }

  private parseRequestStatus(status?: string) {
    if (!status) return undefined;
    if (!COORDINATOR_STATUSES.includes(status as RequestStatus)) {
      throw new BadRequestException('Invalid coordinator request status');
    }
    return status as RequestStatus;
  }

  private parseReservationStatus(status?: string) {
    if (!status) return undefined;
    if (
      !Object.values(ReservationStatus).includes(status as ReservationStatus)
    ) {
      throw new BadRequestException('Invalid reservation status');
    }
    return status as ReservationStatus;
  }

  private reservationRelations() {
    return {
      volunteer: {
        select: { id: true, name: true, email: true, phone: true },
      },
      request: {
        select: {
          id: true,
          title: true,
          requestType: true,
          totalPages: true,
          pdfOriginalName: true,
        },
      },
    } satisfies Prisma.PageReservationInclude;
  }

  private getEffectiveStatus(reservation: {
    status: ReservationStatus;
    deadlineAt: Date;
  }) {
    return reservation.status === ReservationStatus.IN_PROGRESS &&
      reservation.deadlineAt < new Date()
      ? ReservationStatus.LATE
      : reservation.status;
  }

  private withEffectiveStatus(reservation: ReservationWithRelations) {
    return {
      ...reservation,
      effectiveStatus: this.getEffectiveStatus(reservation),
    };
  }
}
