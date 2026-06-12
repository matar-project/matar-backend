import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { open, stat, unlink } from 'fs/promises';
import { basename, extname, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { CreateReservationDto } from './dto/reservation.dto';
import { UpdateCoordinatorRequestDto } from './dto/coordinator-action.dto';
import {
  Prisma,
  LibraryItemType,
  RequestStatus,
  RequestType,
  ReservationStatus,
} from '../generated/prisma/client';
import { REQUEST_OUTPUT_DIRECTORY } from './request-output-upload.config';
import { REQUEST_PDF_DIRECTORY } from './request-upload.config';
import { paginated, pagination } from '../common/pagination';
import {
  RESERVATION_OUTPUT_DIRECTORY,
} from './reservation-output-upload.config';
import { DocxMergeService } from './docx-merge.service';

const COORDINATOR_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING_COORDINATOR,
  RequestStatus.COORDINATOR_ACCEPTED,
  RequestStatus.COORDINATOR_REJECTED,
  RequestStatus.DONE,
];

const COORDINATOR_DERIVED_STATUSES = [
  'IN_PROGRESS',
  'AWAITING_COMPLETION_APPROVAL',
] as const;

type CoordinatorRequestFilter =
  | RequestStatus
  | 'ALL'
  | (typeof COORDINATOR_DERIVED_STATUSES)[number];

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
          bookName: true;
          requestType: true;
          totalPages: true;
      };
    };
  };
}>;

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly docxMergeService: DocxMergeService,
  ) {}

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

  async findAllRequests(
    page = 1,
    limit = 10,
    status?: string,
    search?: string,
  ) {
    this.logger.log(
      `Listing service requests: page=${page} limit=${limit} status=${status ?? 'all'}`,
    );
    const paging = pagination(page, limit);
    const where: Prisma.RequestWhereInput = {
      ...(status ? { status: status as RequestStatus } : {}),
      ...this.requestSearchWhere(search),
    };
    const [data, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        skip: paging.skip,
        take: paging.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.request.count({ where }),
    ]);
    this.logger.log(`Service requests fetched: total=${total}`);
    return paginated(data, total, paging.page, paging.limit);
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

  async getCoordinatorRequests(
    status?: string,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    const parsedStatus = this.parseRequestStatus(status);
    const paging = pagination(page, limit);
    const derivedStatus = COORDINATOR_DERIVED_STATUSES.includes(
      parsedStatus as (typeof COORDINATOR_DERIVED_STATUSES)[number],
    );
    const where: Prisma.RequestWhereInput = {
      status: derivedStatus
        ? RequestStatus.COORDINATOR_ACCEPTED
        : parsedStatus
          ? (parsedStatus as RequestStatus)
          : { in: COORDINATOR_STATUSES },
      ...this.requestSearchWhere(search),
    };
    const requests = await this.prisma.request.findMany({
      where,
      ...(derivedStatus
        ? {}
        : { skip: paging.skip, take: paging.limit }),
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
        conversionBook: true,
        reservations: {
          where: { status: { not: ReservationStatus.REJECTED } },
          select: {
            startPage: true,
            endPage: true,
            status: true,
            outputStoredName: true,
          },
          orderBy: { startPage: 'asc' },
        },
        volunteerAssignment: {
          include: {
            volunteer: {
              select: { id: true, name: true, phone: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const requestsWithProgress = requests.map((request) => ({
      ...request,
      conversionProgress: this.getConversionProgress(
        request.totalPages,
        request.reservations,
        request.requestType === RequestType.PDF_TO_WORD,
      ),
    }));
    const filteredRequests = derivedStatus
      ? requestsWithProgress.filter((request) =>
          parsedStatus === 'AWAITING_COMPLETION_APPROVAL'
            ? request.conversionProgress.canApproveCompletion
            : !request.conversionProgress.canApproveCompletion,
        )
      : requestsWithProgress;
    const total = derivedStatus
      ? filteredRequests.length
      : await this.prisma.request.count({ where });
    const data = derivedStatus
      ? filteredRequests.slice(paging.skip, paging.skip + paging.limit)
      : filteredRequests;

    return paginated(data, total, paging.page, paging.limit);
  }

  async acceptRequest(id: number, coordinatorId: number, notes?: string) {
    const request = await this.requirePendingRequest(id);
    return this.prisma.$transaction(async (tx) => {
      const conversionBookId = RESERVABLE_TYPES.includes(request.requestType)
        ? await this.upsertConversionBook(tx, request.bookName)
        : null;

      return tx.request.update({
        where: { id },
        data: {
          status: RequestStatus.COORDINATOR_ACCEPTED,
          coordinatorId,
          coordinatorNotes: notes?.trim() || null,
          conversionBookId,
        },
        include: { conversionBook: true },
      });
    });
  }

  async updateCoordinatorRequest(
    id: number,
    dto: UpdateCoordinatorRequestDto,
  ) {
    const request = await this.prisma.request.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');

    return this.prisma.$transaction(async (tx) => {
      let conversionBookId = request.conversionBookId;
      if (
        dto.bookName &&
        request.status !== RequestStatus.PENDING_COORDINATOR &&
        RESERVABLE_TYPES.includes(request.requestType)
      ) {
        conversionBookId = await this.upsertConversionBook(tx, dto.bookName);
      }

      return tx.request.update({
        where: { id },
        data: { ...dto, conversionBookId },
        include: { conversionBook: true },
      });
    });
  }

  async approveRequestCompletion(id: number, coordinatorId: number) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      include: {
        conversionBook: true,
        reservations: {
          where: { status: { not: ReservationStatus.REJECTED } },
          select: {
            startPage: true,
            endPage: true,
            status: true,
            outputStoredName: true,
          },
          orderBy: { startPage: 'asc' },
        },
      },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (
      request.status !== RequestStatus.COORDINATOR_ACCEPTED ||
      !RESERVABLE_TYPES.includes(request.requestType)
    ) {
      throw new BadRequestException(
        'Only accepted conversion requests can be completed',
      );
    }
    if (!request.conversionBook) {
      throw new BadRequestException('This request is not linked to a book');
    }
    const conversionBook = request.conversionBook;

    const progress = this.getConversionProgress(
      request.totalPages,
      request.reservations,
      request.requestType === RequestType.PDF_TO_WORD,
    );
    if (!progress.canApproveCompletion) {
      throw new BadRequestException(
        'All pages and required output files must be completed before coordinator approval',
      );
    }
    if (
      request.requestType === RequestType.PDF_TO_WORD &&
      !request.outputStoredName
    ) {
      throw new BadRequestException('The combined Word file is not ready');
    }

    const completedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.conversionBook.update({
        where: { id: request.conversionBook!.id },
        data:
          request.requestType === RequestType.PDF_TO_WORD
            ? { wordCompleted: true, wordCompletedAt: completedAt }
            : { audioCompleted: true, audioCompletedAt: completedAt },
      });

      const completedRequest = await tx.request.update({
        where: { id },
        data: {
          status: RequestStatus.DONE,
          coordinatorId,
        },
        include: { conversionBook: true },
      });

      if (
        request.requestType === RequestType.PDF_TO_WORD &&
        request.outputStoredName &&
        request.outputOriginalName
      ) {
        await tx.libraryItem.upsert({
          where: { sourceRequestId: request.id },
          create: {
            title:
              request.bookName ??
              request.title ??
              conversionBook.name,
            description: request.details,
            country: request.country,
            itemType: LibraryItemType.WORD_DOC,
            fileUrl: `/api/library/request/${request.id}/download`,
            fileName: request.outputOriginalName,
            fileSize: request.outputFileSize,
            sourceRequestId: request.id,
          },
          update: {
            title:
              request.bookName ??
              request.title ??
              conversionBook.name,
            description: request.details,
            country: request.country,
            itemType: LibraryItemType.WORD_DOC,
            fileUrl: `/api/library/request/${request.id}/download`,
            fileName: request.outputOriginalName,
            fileSize: request.outputFileSize,
            published: true,
          },
        });
      }

      return completedRequest;
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

  async getCoordinatorReservations(
    status?: string,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    const parsedStatus = this.parseReservationStatus(status);
    const paging = pagination(page, limit);
    const where: Prisma.PageReservationWhereInput = {
      ...(parsedStatus === ReservationStatus.LATE
        ? {
            status: ReservationStatus.IN_PROGRESS,
            deadlineAt: { lt: new Date() },
          }
        : parsedStatus
          ? { status: parsedStatus }
          : {}),
      ...this.reservationSearchWhere(search),
    };
    const [reservations, total] = await Promise.all([
      this.prisma.pageReservation.findMany({
      where,
      skip: paging.skip,
      take: paging.limit,
      include: this.reservationRelations(),
      orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pageReservation.count({ where }),
    ]);

    const data = reservations.map((reservation) =>
      this.withEffectiveStatus(reservation),
    );
    return paginated(data, total, paging.page, paging.limit);
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

  async getAvailableRequests(
    volunteerId: number,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    const paging = pagination(page, limit);
    const where: Prisma.RequestWhereInput = {
        status: RequestStatus.COORDINATOR_ACCEPTED,
        reservations: {
          none: {
            volunteerId,
            status: ReservationStatus.IN_PROGRESS,
          },
        },
        OR: [
          {
            requestType: { in: RESERVABLE_TYPES },
            totalPages: { not: null },
          },
          {
            requestType: RequestType.ACCOMPANIMENT,
            volunteerAssignment: null,
          },
        ],
        AND: this.requestSearchAnd(search),
      };
    const [requests, total] = await Promise.all([
      this.prisma.request.findMany({
      where,
      skip: paging.skip,
      take: paging.limit,
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
        volunteerAssignment: true,
      },
      orderBy: { createdAt: 'desc' },
      }),
      this.prisma.request.count({ where }),
    ]);

    const data = requests.map((request) => ({
      ...request,
      nextAvailablePage:
        request.requestType === RequestType.ACCOMPANIMENT
          ? null
          : this.getNextAvailablePage(request.reservations),
      reservedRanges: request.reservations.map((reservation) => ({
        ...reservation,
        effectiveStatus: this.getEffectiveStatus(reservation),
      })),
    }));
    return paginated(data, total, paging.page, paging.limit);
  }

  async getVolunteerDashboard(volunteerId: number) {
    const now = new Date();
    const [acceptedRequests, activeReservations, completedReservations] =
      await Promise.all([
        this.prisma.request.findMany({
          where: { status: RequestStatus.COORDINATOR_ACCEPTED },
          include: {
            reservations: {
              where: { status: { not: ReservationStatus.REJECTED } },
              select: {
                volunteerId: true,
                startPage: true,
                endPage: true,
                status: true,
              },
            },
            volunteerAssignment: { select: { volunteerId: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.pageReservation.count({
          where: {
            volunteerId,
            status: ReservationStatus.IN_PROGRESS,
            deadlineAt: { gte: now },
          },
        }),
        this.prisma.pageReservation.count({
          where: { volunteerId, status: ReservationStatus.DONE },
        }),
      ]);

    const availableRequests = acceptedRequests.filter((request) => {
      if (request.requestType === RequestType.ACCOMPANIMENT) {
        return !request.volunteerAssignment;
      }
      if (!request.totalPages) return false;
      const hasActiveReservation = request.reservations.some(
        (reservation) =>
          reservation.volunteerId === volunteerId &&
          reservation.status === ReservationStatus.IN_PROGRESS,
      );
      return (
        !hasActiveReservation &&
        this.getNextAvailablePage(request.reservations) <= request.totalPages
      );
    });

    const [activeAccompaniment, completedAccompaniment] = await Promise.all([
      this.prisma.requestVolunteerAssignment.count({
        where: { volunteerId, status: ReservationStatus.IN_PROGRESS },
      }),
      this.prisma.requestVolunteerAssignment.count({
        where: { volunteerId, status: ReservationStatus.DONE },
      }),
    ]);

    return {
      available: availableRequests.length,
      inProgress: activeReservations + activeAccompaniment,
      completed: completedReservations + completedAccompaniment,
      recentAvailable: availableRequests.slice(0, 5).map((request) => ({
        id: request.id,
        title:
          request.bookName ??
          request.title ??
          (request.requestType === RequestType.ACCOMPANIMENT
            ? 'طلب مرافقة'
            : 'طلب تحويل كتاب'),
        requestType: request.requestType,
        details: request.details,
        totalPages: request.totalPages,
        nextAvailablePage:
          request.requestType === RequestType.ACCOMPANIMENT
            ? null
            : this.getNextAvailablePage(request.reservations),
      })),
    };
  }

  async claimAccompanimentRequest(requestId: number, volunteerId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const request = await tx.request.findUnique({
          where: { id: requestId },
          select: {
            id: true,
            requestType: true,
            status: true,
            volunteerAssignment: { select: { id: true } },
          },
        });

        if (!request) throw new NotFoundException('Request not found');
        if (
          request.requestType !== RequestType.ACCOMPANIMENT ||
          request.status !== RequestStatus.COORDINATOR_ACCEPTED
        ) {
          throw new BadRequestException(
            'This accompaniment request is not available',
          );
        }
        if (request.volunteerAssignment) {
          throw new ConflictException(
            'This accompaniment request has already been claimed',
          );
        }

        return tx.requestVolunteerAssignment.create({
          data: { requestId, volunteerId },
          include: {
            request: true,
            volunteer: {
              select: { id: true, name: true, phone: true, email: true },
            },
          },
        });
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This accompaniment request has already been claimed',
        );
      }
      throw error;
    }
  }

  async getMyAccompanimentRequests(
    volunteerId: number,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    const paging = pagination(page, limit);
    const term = search?.trim();
    const where: Prisma.RequestVolunteerAssignmentWhereInput = {
      volunteerId,
      ...(term
        ? {
            request: {
              OR: ['title', 'bookName', 'details', 'fullName', 'phone'].map(
                (field) => ({
                  [field]: { contains: term, mode: 'insensitive' as const },
                }),
              ),
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.requestVolunteerAssignment.findMany({
      where,
      skip: paging.skip,
      take: paging.limit,
      include: {
        request: {
          include: {
            coordinator: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      }),
      this.prisma.requestVolunteerAssignment.count({ where }),
    ]);
    return paginated(data, total, paging.page, paging.limit);
  }

  async createReservation(
    requestId: number,
    volunteerId: number,
    dto: CreateReservationDto,
  ) {
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

          const activeReservations = await tx.pageReservation.findMany({
            where: {
              requestId,
              status: { not: ReservationStatus.REJECTED },
            },
            select: { startPage: true, endPage: true },
            orderBy: { endPage: 'asc' },
          });

          const startPage = this.getNextAvailablePage(activeReservations);
          if (startPage > request.totalPages) {
            throw new BadRequestException(
              'All pages have already been reserved',
            );
          }
          if (dto.endPage < startPage) {
            throw new BadRequestException(
              `End page must be greater than or equal to ${startPage}`,
            );
          }

          return tx.pageReservation.create({
            data: {
              requestId,
              volunteerId,
              startPage,
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

  async getMyReservations(
    volunteerId: number,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    const paging = pagination(page, limit);
    const where: Prisma.PageReservationWhereInput = {
      volunteerId,
      ...this.reservationSearchWhere(search),
    };
    const [reservations, total] = await Promise.all([
      this.prisma.pageReservation.findMany({
      where,
      skip: paging.skip,
      take: paging.limit,
      include: this.reservationRelations(),
      orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pageReservation.count({ where }),
    ]);
    const data = reservations.map((reservation) =>
      this.withEffectiveStatus(reservation),
    );
    return paginated(data, total, paging.page, paging.limit);
  }

  async completeReservation(id: number, volunteerId: number) {
    const reservation = await this.requireOwnedActiveReservation(
      id,
      volunteerId,
    );
    const request = await this.prisma.request.findUnique({
      where: { id: reservation.requestId },
      select: { requestType: true },
    });
    if (request?.requestType === RequestType.PDF_TO_WORD) {
      throw new BadRequestException(
        'A Word .docx file is required to complete this reservation',
      );
    }
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

  async completeWordReservation(
    id: number,
    volunteerId: number,
    file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('A Word .docx file is required');
    }

    await this.docxMergeService.validate(file.path);
    const reservation = await this.requireOwnedActiveReservation(
      id,
      volunteerId,
    );
    if (this.getEffectiveStatus(reservation) === ReservationStatus.LATE) {
      throw new BadRequestException(
        'Late reservations cannot be marked as done',
      );
    }

    const request = await this.prisma.request.findUnique({
      where: { id: reservation.requestId },
      include: {
        reservations: {
          where: { status: { not: ReservationStatus.REJECTED } },
          select: {
            id: true,
            startPage: true,
            endPage: true,
            status: true,
            outputStoredName: true,
          },
          orderBy: { startPage: 'asc' },
        },
      },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.requestType !== RequestType.PDF_TO_WORD) {
      throw new BadRequestException(
        'Word files are only accepted for PDF to Word reservations',
      );
    }

    const candidateReservations = request.reservations.map((item) =>
      item.id === reservation.id
        ? {
            ...item,
            status: ReservationStatus.DONE,
            outputStoredName: file.filename,
          }
        : item,
    );
    const progress = this.getConversionProgress(
      request.totalPages,
      candidateReservations,
      true,
    );

    let mergedOutput:
      | { outputPath: string; outputStoredName: string }
      | undefined;
    if (progress.canApproveCompletion) {
      mergedOutput = await this.docxMergeService.merge(
        candidateReservations
          .filter(
            (item) =>
              item.status === ReservationStatus.DONE &&
              item.outputStoredName,
          )
          .map((item) => ({
            startPage: item.startPage,
            path:
              item.id === reservation.id
                ? file.path
                : join(
                    RESERVATION_OUTPUT_DIRECTORY,
                    basename(item.outputStoredName!),
                  ),
          })),
      );
    }

    const oldOutputPath = request.outputStoredName
      ? join(REQUEST_OUTPUT_DIRECTORY, basename(request.outputStoredName))
      : null;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const completedReservation = await tx.pageReservation.update({
          where: { id },
          data: {
            status: ReservationStatus.DONE,
            completedAt: new Date(),
            outputOriginalName: this.normalizeOriginalFileName(
              file.originalname,
            ),
            outputStoredName: file.filename,
            outputMimeType: file.mimetype,
            outputFileSize: file.size,
          },
          include: this.reservationRelations(),
        });

        if (mergedOutput) {
          const outputName = `${request.bookName ?? request.title ?? `request-${request.id}`}-complete.docx`;
          await tx.request.update({
            where: { id: request.id },
            data: {
              outputOriginalName: outputName,
              outputStoredName: mergedOutput.outputStoredName,
              outputMimeType:
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              outputFileSize: (await stat(mergedOutput.outputPath)).size,
            },
          });
        }

        return completedReservation;
      });

      if (mergedOutput && oldOutputPath) {
        await unlink(oldOutputPath).catch(() => undefined);
      }
      if (!mergedOutput) {
        await this.assembleCompletedWordRequest(request.id);
      }
      return this.withEffectiveStatus(updated);
    } catch (error) {
      if (mergedOutput) {
        await unlink(mergedOutput.outputPath).catch(() => undefined);
      }
      throw error;
    }
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

  async getMyRequests(userId: number, page = 1, limit = 10) {
    const paging = pagination(page, limit);
    const where: Prisma.RequestWhereInput = { createdByUserId: userId };
    const [data, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        skip: paging.skip,
        take: paging.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          requestType: true,
          bookName: true,
          details: true,
          status: true,
          coordinatorNotes: true,
          outputOriginalName: true,
          createdAt: true,
        },
      }),
      this.prisma.request.count({ where }),
    ]);
    return paginated(data, total, paging.page, paging.limit);
  }

  async uploadOutputFile(
    requestId: number,
    _coordinatorId: number,
    file: Express.Multer.File,
  ) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        reservations: {
          where: { status: { not: ReservationStatus.REJECTED } },
          select: {
            startPage: true,
            endPage: true,
            status: true,
            outputStoredName: true,
          },
          orderBy: { startPage: 'asc' },
        },
      },
    });
    if (!request) {
      await unlink(file.path).catch(() => undefined);
      throw new NotFoundException('Request not found');
    }
    const canReplaceBeforeApproval =
      request.status === RequestStatus.COORDINATOR_ACCEPTED &&
      request.requestType === RequestType.PDF_TO_WORD &&
      this.getConversionProgress(
        request.totalPages,
        request.reservations,
        true,
      ).canApproveCompletion;
    if (
      request.status !== RequestStatus.DONE &&
      !canReplaceBeforeApproval
    ) {
      await unlink(file.path).catch(() => undefined);
      throw new BadRequestException(
        'The final file can only be replaced after all pages are completed',
      );
    }
    if (
      request.requestType === RequestType.PDF_TO_WORD &&
      extname(file.originalname).toLowerCase() !== '.docx'
    ) {
      await unlink(file.path).catch(() => undefined);
      throw new BadRequestException(
        'The final PDF to Word file must be a .docx file',
      );
    }
    if (request.requestType === RequestType.PDF_TO_WORD) {
      await this.docxMergeService.validate(file.path);
    }

    const oldPath = request.outputStoredName
      ? join(
        REQUEST_OUTPUT_DIRECTORY,
        basename(request.outputStoredName),
      )
      : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.request.update({
        where: { id: requestId },
        data: {
          outputOriginalName: this.normalizeOriginalFileName(
            file.originalname,
          ),
          outputStoredName: file.filename,
          outputMimeType: file.mimetype,
          outputFileSize: file.size,
        },
      });

      if (request.status === RequestStatus.DONE) {
        await tx.libraryItem.updateMany({
          where: { sourceRequestId: requestId },
          data: {
            fileName: updatedRequest.outputOriginalName!,
            fileSize: updatedRequest.outputFileSize,
          },
        });
      }

      return updatedRequest;
    });
    if (oldPath) await unlink(oldPath).catch(() => undefined);
    return updated;
  }

  async downloadOutputFile(
    requestId: number,
    user: { sub: number; role: string },
  ) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: {
        createdByUserId: true,
        outputOriginalName: true,
        outputStoredName: true,
      },
    });

    if (!request) throw new NotFoundException('Request not found');

    const isOwner =
      user.role === 'visually_impired' && request.createdByUserId === user.sub;
    const isCoordinator = user.role === 'coordinator';

    if (!isOwner && !isCoordinator) {
      throw new ForbiddenException('You do not have access to this file');
    }
    if (!request.outputStoredName || !request.outputOriginalName) {
      throw new NotFoundException('Output file not found');
    }

    const storedName = basename(request.outputStoredName);
    const path = join(REQUEST_OUTPUT_DIRECTORY, storedName);
    if (!existsSync(path)) throw new NotFoundException('Output file not found');

    return { path, originalName: request.outputOriginalName };
  }

  async getStats() {
    this.logger.log('Fetching dashboard stats');
    const [
      totalVolunteers,
      totalRequests,
      completedRequests,
      libraryItems,
      opportunities,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: { name: 'volunteer' } } }),
      this.prisma.request.count(),
      this.prisma.request.count({ where: { status: RequestStatus.DONE } }),
      this.prisma.libraryItem.count(),
      this.prisma.opportunity.count({ where: { status: 'AVAILABLE' as any } }),
    ]);
    const stats = {
      totalVolunteers,
      totalRequests,
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

  private parseRequestStatus(
    status?: string,
  ): CoordinatorRequestFilter | undefined {
    if (!status || status === 'ALL') return undefined;
    if (
      !COORDINATOR_STATUSES.includes(status as RequestStatus) &&
      !COORDINATOR_DERIVED_STATUSES.includes(
        status as (typeof COORDINATOR_DERIVED_STATUSES)[number],
      )
    ) {
      throw new BadRequestException('Invalid coordinator request status');
    }
    return status as CoordinatorRequestFilter;
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
          bookName: true,
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

  private getNextAvailablePage(
    reservations: Array<{ startPage: number; endPage: number }>,
  ) {
    return (
      reservations.reduce(
        (highestEndPage, reservation) =>
          Math.max(highestEndPage, reservation.endPage),
        0,
      ) + 1
    );
  }

  private normalizeBookName(bookName: string) {
    return bookName.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  private async upsertConversionBook(
    tx: Prisma.TransactionClient,
    bookName?: string | null,
  ) {
    const name = bookName?.trim().replace(/\s+/g, ' ');
    if (!name) {
      throw new BadRequestException(
        'Book name is required for conversion requests',
      );
    }

    const book = await tx.conversionBook.upsert({
      where: { normalizedName: this.normalizeBookName(name) },
      create: { name, normalizedName: this.normalizeBookName(name) },
      update: { name },
      select: { id: true },
    });
    return book.id;
  }

  private async assembleCompletedWordRequest(requestId: number) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        title: true,
        bookName: true,
        totalPages: true,
        requestType: true,
        outputStoredName: true,
        reservations: {
          where: { status: { not: ReservationStatus.REJECTED } },
          select: {
            startPage: true,
            endPage: true,
            status: true,
            outputStoredName: true,
          },
          orderBy: { startPage: 'asc' },
        },
      },
    });
    if (
      !request ||
      request.requestType !== RequestType.PDF_TO_WORD ||
      request.outputStoredName ||
      !this.getConversionProgress(
        request.totalPages,
        request.reservations,
        true,
      ).canApproveCompletion
    ) {
      return;
    }

    const mergedOutput = await this.docxMergeService.merge(
      request.reservations.map((reservation) => ({
        startPage: reservation.startPage,
        path: join(
          RESERVATION_OUTPUT_DIRECTORY,
          basename(reservation.outputStoredName!),
        ),
      })),
    );
    const result = await this.prisma.request.updateMany({
      where: { id: request.id, outputStoredName: null },
      data: {
        outputOriginalName: `${request.bookName ?? request.title ?? `request-${request.id}`}-complete.docx`,
        outputStoredName: mergedOutput.outputStoredName,
        outputMimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        outputFileSize: (await stat(mergedOutput.outputPath)).size,
      },
    });
    if (result.count === 0) {
      await unlink(mergedOutput.outputPath).catch(() => undefined);
    }
  }

  private getConversionProgress(
    totalPages: number | null,
    reservations: Array<{
      startPage: number;
      endPage: number;
      status: ReservationStatus;
      outputStoredName?: string | null;
    }>,
    requireOutputFiles = false,
  ) {
    const doneReservations = reservations
      .filter(
        (reservation) =>
          reservation.status === ReservationStatus.DONE &&
          (!requireOutputFiles || Boolean(reservation.outputStoredName)),
      )
      .sort((a, b) => a.startPage - b.startPage);
    let coveredThroughPage = 0;

    for (const reservation of doneReservations) {
      if (reservation.startPage > coveredThroughPage + 1) break;
      coveredThroughPage = Math.max(coveredThroughPage, reservation.endPage);
    }

    const hasActiveReservations = reservations.some(
      (reservation) => reservation.status === ReservationStatus.IN_PROGRESS,
    );
    return {
      completedThroughPage: coveredThroughPage,
      totalPages,
      canApproveCompletion:
        Boolean(totalPages) &&
        coveredThroughPage >= (totalPages ?? 0) &&
        !hasActiveReservations,
    };
  }

  private requestSearchAnd(search?: string): Prisma.RequestWhereInput[] {
    const term = search?.trim();
    if (!term) return [];
    const numeric = Number(term);
    return [
      {
        OR: [
          ...[
            'fullName',
            'phone',
            'email',
            'country',
            'city',
            'title',
            'bookName',
            'details',
            'pdfOriginalName',
            'coordinatorNotes',
          ].map((field) => ({
            [field]: { contains: term, mode: 'insensitive' as const },
          })),
          ...(Number.isInteger(numeric) ? [{ totalPages: numeric }] : []),
        ],
      },
    ];
  }

  private requestSearchWhere(search?: string): Prisma.RequestWhereInput {
    const AND = this.requestSearchAnd(search);
    return AND.length ? { AND } : {};
  }

  private reservationSearchWhere(
    search?: string,
  ): Prisma.PageReservationWhereInput {
    const term = search?.trim();
    if (!term) return {};
    const numeric = Number(term);
    return {
      OR: [
        {
          volunteer: {
            OR: ['name', 'email', 'phone'].map((field) => ({
              [field]: { contains: term, mode: 'insensitive' as const },
            })),
          },
        },
        {
          request: {
            OR: ['title', 'bookName', 'details', 'fullName', 'phone'].map(
              (field) => ({
                [field]: { contains: term, mode: 'insensitive' as const },
              }),
            ),
          },
        },
        ...(Number.isInteger(numeric)
          ? [{ startPage: numeric }, { endPage: numeric }]
          : []),
      ],
    };
  }

  private withEffectiveStatus(reservation: ReservationWithRelations) {
    return {
      ...reservation,
      effectiveStatus: this.getEffectiveStatus(reservation),
    };
  }
}
