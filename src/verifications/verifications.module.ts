import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VerificationsController } from './verifications.controller';
import { VerificationsService } from './verifications.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [VerificationsController],
  providers: [VerificationsService],
})
export class VerificationsModule {}
