import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { VolunteersModule } from './volunteers/volunteers.module';
import { RequestsModule } from './requests/requests.module';
import { LibraryModule } from './library/library.module';
import { SettingsModule } from './settings/settings.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { MailModule } from './mail/mail.module';
import { VerificationsModule } from './verifications/verifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    VolunteersModule,
    RequestsModule,
    LibraryModule,
    SettingsModule,
    OpportunitiesModule,
    MailModule,
    VerificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
