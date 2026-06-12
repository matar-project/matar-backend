import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { basename, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLibraryItemDto } from './dto/create-library-item.dto';
import { paginated, pagination } from '../common/pagination';
import { REQUEST_OUTPUT_DIRECTORY } from '../requests/request-output-upload.config';

@Injectable()
export class LibraryService {
  private readonly logger = new Logger(LibraryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findCompletedBooks(search?: string, page = 1, limit = 10) {
    const paging = pagination(page, limit);
    const where = {
      AND: [
        { OR: [{ wordCompleted: true }, { audioCompleted: true }] },
        search
          ? { name: { contains: search, mode: 'insensitive' as const } }
          : {},
      ],
    };
    const [data, total] = await Promise.all([
      this.prisma.conversionBook.findMany({
        where,
        skip: paging.skip,
        take: paging.limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.conversionBook.count({ where }),
    ]);
    return paginated(data, total, paging.page, paging.limit);
  }

  async findAll(search?: string, author?: string, subject?: string, curriculum?: string, country?: string, page = 1, limit = 10) {
    this.logger.log(`Listing library items: page=${page} limit=${limit} search="${search ?? ''}" author="${author ?? ''}" subject="${subject ?? ''}"`);
    const paging = pagination(page, limit);
    const where: any = { published: true };
    if (search) {
      where.OR = [
        'title',
        'author',
        'subject',
        'curriculum',
        'country',
        'description',
        'fileName',
        'fileUrl',
      ].map((field) => ({
        [field]: { contains: search.trim(), mode: 'insensitive' },
      }));
    }
    if (author) where.author = { contains: author, mode: 'insensitive' };
    if (subject) where.subject = { contains: subject, mode: 'insensitive' };
    if (curriculum) where.curriculum = { contains: curriculum, mode: 'insensitive' };
    if (country) where.country = { contains: country, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.libraryItem.findMany({ where, skip: paging.skip, take: paging.limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.libraryItem.count({ where }),
    ]);
    this.logger.log(`Library items fetched: total=${total}`);
    return paginated(data, total, paging.page, paging.limit);
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

  async findAllAdmin(page = 1, limit = 10, search?: string) {
    this.logger.log(`Admin listing library items: page=${page} limit=${limit}`);
    const paging = pagination(page, limit);
    const term = search?.trim();
    const where = term
      ? {
          OR: [
            'title',
            'author',
            'subject',
            'curriculum',
            'country',
            'description',
            'fileName',
            'fileUrl',
          ].map((field) => ({
            [field]: { contains: term, mode: 'insensitive' as const },
          })),
        }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.libraryItem.findMany({ where, skip: paging.skip, take: paging.limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.libraryItem.count({ where }),
    ]);
    this.logger.log(`Admin library items fetched: total=${total}`);
    return paginated(data, total, paging.page, paging.limit);
  }

  async getDownload(id: number) {
    const item = await this.prisma.libraryItem.findUnique({
      where: { id },
      include: {
        sourceRequest: {
          select: {
            outputOriginalName: true,
            outputStoredName: true,
          },
        },
      },
    });
    if (!item?.published) throw new NotFoundException('Library item not found');
    if (
      !item.sourceRequest?.outputStoredName ||
      !item.sourceRequest.outputOriginalName
    ) {
      throw new NotFoundException('Library file not found');
    }

    const path = join(
      REQUEST_OUTPUT_DIRECTORY,
      basename(item.sourceRequest.outputStoredName),
    );
    if (!existsSync(path)) throw new NotFoundException('Library file not found');
    return { path, originalName: item.sourceRequest.outputOriginalName };
  }
}
