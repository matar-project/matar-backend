import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get() {
    this.logger.log('Fetching settings');
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings) {
      this.logger.log('Settings not found — initializing defaults');
      return this.prisma.settings.create({ data: { id: 1 } });
    }
    return settings;
  }

  async update(dto: { whatsappLink?: string; facebookLink?: string; messengerLink?: string }) {
    this.logger.log('Updating settings');
    const updated = await this.prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1, ...dto },
      update: dto,
    });
    this.logger.log('Settings updated');
    return updated;
  }
}
