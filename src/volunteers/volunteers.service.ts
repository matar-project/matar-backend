import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';

@Injectable()
export class VolunteersService {
  private readonly logger = new Logger(VolunteersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateVolunteerDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.phone || !user.country || !user.city) {
      throw new BadRequestException('Complete your country, city, and phone number before volunteering');
    }

    this.logger.log(`Creating volunteer: name=${user.name} email=${user.email}`);
    const volunteer = await this.prisma.volunteer.create({
      data: {
        ...dto,
        name: user.name,
        email: user.email,
        phone: user.phone,
        country: user.country,
        city: user.city,
        preferredContact: 'WHATSAPP',
      },
    });
    this.logger.log(`Volunteer created: id=${volunteer.id}`);
    return volunteer;
  }

  async findAll(page = 1, limit = 20) {
    this.logger.log(`Listing volunteers: page=${page} limit=${limit}`);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.volunteer.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.volunteer.count(),
    ]);
    this.logger.log(`Volunteers fetched: total=${total}`);
    return { data, total, page, limit };
  }

  async update(id: number, dto: { contacted?: boolean; notes?: string }) {
    this.logger.log(`Updating volunteer id=${id}`);
    const exists = await this.prisma.volunteer.findUnique({ where: { id } });
    if (!exists) {
      this.logger.warn(`Volunteer not found: id=${id}`);
      throw new NotFoundException('Volunteer not found');
    }
    const updated = await this.prisma.volunteer.update({ where: { id }, data: dto });
    this.logger.log(`Volunteer updated: id=${id}`);
    return updated;
  }
}
