import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';

@Injectable()
export class VolunteersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVolunteerDto) {
    return this.prisma.volunteer.create({ data: dto });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.volunteer.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.volunteer.count(),
    ]);
    return { data, total, page, limit };
  }

  async update(id: number, dto: { contacted?: boolean; notes?: string }) {
    const exists = await this.prisma.volunteer.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Volunteer not found');
    return this.prisma.volunteer.update({ where: { id }, data: dto });
  }
}
