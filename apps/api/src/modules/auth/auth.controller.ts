import { Controller, Get, UseGuards, Inject } from '@nestjs/common';
import { AuthService } from './auth.service';
import { NestPermissionGuard } from '../../common/guards/nest-permission.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { SecurityContext } from '../iam/permission.guard';

@Controller('api/v1/auth')
@UseGuards(NestPermissionGuard)
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get('me')
  public getMe(@CurrentUser() userCtx: SecurityContext) {
    return this.authService.getCurrentUser(userCtx);
  }
}
