import { Injectable, ForbiddenException, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class AdminGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
