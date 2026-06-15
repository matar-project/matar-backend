import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class VolunteerGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== 'volunteer') {
      throw new ForbiddenException('Volunteer access required');
    }
    if (request.user?.status !== 'ACTIVE') {
      throw new ForbiddenException('Active account required');
    }

    return true;
  }
}
