import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLibraryItemDto } from './dto/create-library-item.dto';

@Injectable()
export class LibraryService {
  private readonly logger = new Logger(LibraryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string, author?: string, subject?: string, curriculum?: string, country?: string, page = 1, limit = 20) {
    this.logger.log(`Listing library items: page=${page} limit=${limit} search="${search ?? ''}" author="${author ?? ''}" subject="${subject ?? ''}"`);
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
    this.logger.log(`Library items fetched: total=${total}`);
    return { data, total, page, limit };
  }

  async findOne(id: number) {
    this.logger.log(`Fetching library item id=${id}`);
    const item = await this.prisma.libraryItem.findUnique({ where: { id } });
    if (!item || !item.published) {
      this.logger.warn(`Library item not found or unpublished: id=${id}`);
      throw new NotFoundException('Library item not found');
    }
    return item;
  }

  async create(dto: CreateLibraryItemDto) {
    this.logger.log(`Creating library item: title="${dto.title}"`);
    const item = await this.prisma.libraryItem.create({ data: dto as any });
    this.logger.log(`Library item created: id=${item.id}`);
    return item;
  }

  async update(id: number, dto: Partial<CreateLibraryItemDto>) {
    this.logger.log(`Updating library item id=${id}`);
    const exists = await this.prisma.libraryItem.findUnique({ where: { id } });
    if (!exists) {
      this.logger.warn(`Library item not found: id=${id}`);
      throw new NotFoundException('Library item not found');
    }
    const updated = await this.prisma.libraryItem.update({ where: { id }, data: dto as any });
    this.logger.log(`Library item updated: id=${id}`);
    return updated;
  }

  async remove(id: number) {
    this.logger.log(`Deleting library item id=${id}`);
    const exists = await this.prisma.libraryItem.findUnique({ where: { id } });
    if (!exists) {
      this.logger.warn(`Library item not found: id=${id}`);
      throw new NotFoundException('Library item not found');
    }
    const deleted = await this.prisma.libraryItem.delete({ where: { id } });
    this.logger.log(`Library item deleted: id=${id}`);
    return deleted;
  }

  async findAllAdmin(page = 1, limit = 20) {
    this.logger.log(`Admin listing library items: page=${page} limit=${limit}`);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.libraryItem.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.libraryItem.count(),
    ]);
    this.logger.log(`Admin library items fetched: total=${total}`);
    return { data, total, page, limit };
  }
}
