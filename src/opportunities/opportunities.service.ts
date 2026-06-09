import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OpportunitiesService {
  private readonly logger = new Logger(OpportunitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    this.logger.log('Listing active opportunities');
    const items = await this.prisma.opportunity.findMany({
      where: { status: { not: 'COMPLETED' as any } },
      orderBy: { createdAt: 'desc' },
    });
    this.logger.log(`Opportunities fetched: count=${items.length}`);
    return items;
  }

  async create(dto: { title: string; description?: string; subject?: string; totalPages?: number; remainingPages?: number }) {
    this.logger.log(`Creating opportunity: title="${dto.title}"`);
    const opportunity = await this.prisma.opportunity.create({ data: dto });
    this.logger.log(`Opportunity created: id=${opportunity.id}`);
    return opportunity;
  }

  async update(id: number, dto: { title?: string; description?: string; subject?: string; totalPages?: number; remainingPages?: number; status?: string }) {
    this.logger.log(`Updating opportunity id=${id}`);
    const exists = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!exists) {
      this.logger.warn(`Opportunity not found: id=${id}`);
      throw new NotFoundException('Opportunity not found');
    }
    const updated = await this.prisma.opportunity.update({ where: { id }, data: dto as any });
    this.logger.log(`Opportunity updated: id=${id} status=${(updated as any).status}`);
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
