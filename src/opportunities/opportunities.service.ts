import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.opportunity.findMany({
      where: { status: { not: 'COMPLETED' as any } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: { title: string; description?: string; subject?: string; totalPages?: number; remainingPages?: number }) {
    return this.prisma.opportunity.create({ data: dto });
  }

  async update(id: number, dto: { title?: string; description?: string; subject?: string; totalPages?: number; remainingPages?: number; status?: string }) {
    const exists = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Opportunity not found');
    return this.prisma.opportunity.update({ where: { id }, data: dto as any });
  }

  async remove(id: number) {
    const exists = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Opportunity not found');
    return this.prisma.opportunity.delete({ where: { id } });
  }
}
