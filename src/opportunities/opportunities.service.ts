import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginated, pagination } from '../common/pagination';
import {
  OpportunityStatus,
  Prisma,
} from '../generated/prisma/client';

@Injectable()
export class OpportunitiesService {
  private readonly logger = new Logger(OpportunitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 10, search?: string) {
    this.logger.log('Listing active opportunities');
    const paging = pagination(page, limit);
    const term = search?.trim();
    const where: Prisma.OpportunityWhereInput = {
      status: { not: OpportunityStatus.COMPLETED },
      ...(term
        ? {
            OR: ['title', 'description', 'subject'].map((field) => ({
              [field]: { contains: term, mode: 'insensitive' as const },
            })),
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.opportunity.findMany({
        where,
        skip: paging.skip,
        take: paging.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.opportunity.count({ where }),
    ]);
    return paginated(data, total, paging.page, paging.limit);
  }

  async findAvailableForVolunteer(
    volunteerId: number,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    const paging = pagination(page, limit);
    const term = search?.trim();
    const where: Prisma.OpportunityWhereInput = {
        status: { not: OpportunityStatus.COMPLETED },
        participants: { none: { volunteerId } },
        ...(term
          ? {
              OR: ['title', 'description', 'subject'].map((field) => ({
                [field]: { contains: term, mode: 'insensitive' as const },
              })),
            }
          : {}),
      };
    const [data, total] = await Promise.all([
      this.prisma.opportunity.findMany({
        where,
        skip: paging.skip,
        take: paging.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.opportunity.count({ where }),
    ]);
    return paginated(data, total, paging.page, paging.limit);
  }

  async join(opportunityId: number, volunteerId: number) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
    });
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    if (opportunity.status === 'COMPLETED') {
      throw new BadRequestException('This opportunity is completed');
    }

    try {
      return await this.prisma.opportunityParticipation.create({
        data: { opportunityId, volunteerId },
      });
    } catch {
      throw new ConflictException('You already joined this opportunity');
    }
  }

  async create(dto: {
    title: string;
    description?: string;
    subject?: string;
    totalPages?: number;
    remainingPages?: number;
  }) {
    this.logger.log(`Creating opportunity: title="${dto.title}"`);
    const opportunity = await this.prisma.opportunity.create({ data: dto });
    this.logger.log(`Opportunity created: id=${opportunity.id}`);
    return opportunity;
  }

  async update(
    id: number,
    dto: {
      title?: string;
      description?: string;
      subject?: string;
      totalPages?: number;
      remainingPages?: number;
      status?: string;
    },
  ) {
    this.logger.log(`Updating opportunity id=${id}`);
    const exists = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!exists) {
      this.logger.warn(`Opportunity not found: id=${id}`);
      throw new NotFoundException('Opportunity not found');
    }
    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: dto as any,
    });
    this.logger.log(
      `Opportunity updated: id=${id} status=${(updated as any).status}`,
    );
    return updated;
  }

  async remove(id: number) {
    this.logger.log(`Deleting opportunity id=${id}`);
    const exists = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!exists) {
      this.logger.warn(`Opportunity not found: id=${id}`);
      throw new NotFoundException('Opportunity not found');
    }
    const deleted = await this.prisma.opportunity.delete({ where: { id } });
    this.logger.log(`Opportunity deleted: id=${id}`);
    return deleted;
  }
}
