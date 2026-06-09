import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLibraryItemDto } from './dto/create-library-item.dto';

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string, author?: string, subject?: string, curriculum?: string, country?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = { published: true };
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (author) where.author = { contains: author, mode: 'insensitive' };
    if (subject) where.subject = { contains: subject, mode: 'insensitive' };
    if (curriculum) where.curriculum = { contains: curriculum, mode: 'insensitive' };
    if (country) where.country = { contains: country, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.libraryItem.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.libraryItem.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: number) {
    const item = await this.prisma.libraryItem.findUnique({ where: { id } });
    if (!item || !item.published) throw new NotFoundException('Library item not found');
    return item;
  }

  async create(dto: CreateLibraryItemDto) {
    return this.prisma.libraryItem.create({ data: dto as any });
  }

  async update(id: number, dto: Partial<CreateLibraryItemDto>) {
    const exists = await this.prisma.libraryItem.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Library item not found');
    return this.prisma.libraryItem.update({ where: { id }, data: dto as any });
  }

  async remove(id: number) {
    const exists = await this.prisma.libraryItem.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Library item not found');
    return this.prisma.libraryItem.delete({ where: { id } });
  }

  async findAllAdmin(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.libraryItem.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.libraryItem.count(),
    ]);
    return { data, total, page, limit };
  }
}
