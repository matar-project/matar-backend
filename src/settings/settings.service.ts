import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings) {
      return this.prisma.settings.create({ data: { id: 1 } });
    }
    return settings;
  }

  async update(dto: { whatsappLink?: string; facebookLink?: string; messengerLink?: string }) {
    return this.prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1, ...dto },
      update: dto,
    });
  }
}
