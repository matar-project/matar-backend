import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateBookRequestDto } from './dto/create-book-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createRequest(dto: CreateRequestDto) {
    this.logger.log('Creating service request');
    const request = await this.prisma.request.create({ data: dto as any });
    this.logger.log(`Service request created: id=${request.id}`);
    return request;
  }

  async createBookRequest(dto: CreateBookRequestDto) {
    this.logger.log('Creating book request');
    const request = await this.prisma.bookRequest.create({ data: dto });
    this.logger.log(`Book request created: id=${request.id}`);
    return request;
  }

  async findAllRequests(page = 1, limit = 20, status?: string) {
    this.logger.log(`Listing service requests: page=${page} limit=${limit} status=${status ?? 'all'}`);
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};
    const [data, total] = await Promise.all([
      this.prisma.request.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.request.count({ where }),
    ]);
    this.logger.log(`Service requests fetched: total=${total}`);
    return { data, total, page, limit };
  }

  async findAllBookRequests(page = 1, limit = 20, status?: string) {
    this.logger.log(`Listing book requests: page=${page} limit=${limit} status=${status ?? 'all'}`);
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};
    const [data, total] = await Promise.all([
      this.prisma.bookRequest.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
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
    const updated = await this.prisma.request.update({ where: { id }, data: dto as any });
    this.logger.log(`Service request updated: id=${id} status=${(updated as any).status ?? 'unchanged'}`);
    return updated;
  }

  async updateBookRequest(id: number, dto: UpdateRequestDto) {
    this.logger.log(`Updating book request id=${id}`);
    const exists = await this.prisma.bookRequest.findUnique({ where: { id } });
    if (!exists) {
      this.logger.warn(`Book request not found: id=${id}`);
      throw new NotFoundException('Book request not found');
    }
    const updated = await this.prisma.bookRequest.update({ where: { id }, data: dto as any });
    this.logger.log(`Book request updated: id=${id}`);
    return updated;
  }

  async getStats() {
    this.logger.log('Fetching dashboard stats');
    const [totalVolunteers, totalRequests, completedRequests, bookRequests, libraryItems, opportunities] = await Promise.all([
      this.prisma.volunteer.count(),
      this.prisma.request.count(),
      this.prisma.request.count({ where: { status: 'COMPLETED' as any } }),
      this.prisma.bookRequest.count(),
      this.prisma.libraryItem.count(),
      this.prisma.opportunity.count({ where: { status: 'AVAILABLE' as any } }),
    ]);
    const stats = { totalVolunteers, totalRequests: totalRequests + bookRequests, completedRequests, libraryItems, opportunities };
    this.logger.log(`Stats: ${JSON.stringify(stats)}`);
    return stats;
  }
}
