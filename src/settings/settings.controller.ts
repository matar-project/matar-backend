import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get()
  get() {
    return this.svc.get();
  }

  @Put('admin')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  update(@Body() dto: { whatsappLink?: string; facebookLink?: string; messengerLink?: string }) {
    return this.svc.update(dto);
  }
}
