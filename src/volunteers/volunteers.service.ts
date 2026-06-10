import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginated, pagination } from '../common/pagination';

@Injectable()
export class VolunteersService {
  private readonly logger = new Logger(VolunteersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 10, search?: string) {
    this.logger.log(`Listing volunteers: page=${page} limit=${limit}`);
    const paging = pagination(page, limit);
    const term = search?.trim();
    const where = {
      role: { name: 'volunteer' },
      ...(term
        ? {
            OR: ['name', 'email', 'phone', 'country', 'city'].map((field) => ({
              [field]: { contains: term, mode: 'insensitive' as const },
            })),
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: paging.skip,
        take: paging.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          country: true,
          city: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    this.logger.log(`Volunteers fetched: total=${total}`);
    return paginated(data, total, paging.page, paging.limit);
  }
}
