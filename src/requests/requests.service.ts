import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateBookRequestDto } from './dto/create-book-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(dto: CreateRequestDto) {
    return this.prisma.request.create({ data: dto as any });
  }

  async createBookRequest(dto: CreateBookRequestDto) {
    return this.prisma.bookRequest.create({ data: dto });
  }

  async findAllRequests(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};
    const [data, total] = await Promise.all([
      this.prisma.request.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.request.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findAllBookRequests(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};
    const [data, total] = await Promise.all([
      this.prisma.bookRequest.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.bookRequest.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateRequest(id: number, dto: UpdateRequestDto) {
    const exists = await this.prisma.request.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Request not found');
    return this.prisma.request.update({ where: { id }, data: dto as any });
  }

  async updateBookRequest(id: number, dto: UpdateRequestDto) {
    const exists = await this.prisma.bookRequest.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Book request not found');
    return this.prisma.bookRequest.update({ where: { id }, data: dto as any });
  }

  async getStats() {
    const [totalVolunteers, totalRequests, completedRequests, bookRequests, libraryItems, opportunities] = await Promise.all([
      this.prisma.volunteer.count(),
      this.prisma.request.count(),
      this.prisma.request.count({ where: { status: 'COMPLETED' as any } }),
      this.prisma.bookRequest.count(),
      this.prisma.libraryItem.count(),
      this.prisma.opportunity.count({ where: { status: 'AVAILABLE' as any } }),
    ]);
    return { totalVolunteers, totalRequests: totalRequests + bookRequests, completedRequests, libraryItems, opportunities };
  }
}
