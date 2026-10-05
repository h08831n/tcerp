import { Injectable } from '@nestjs/common';
import { SecurityContext } from '../iam/permission.guard';

@Injectable()
export class AuthService {
  public getCurrentUser(userCtx: SecurityContext) {
    return {
      user: userCtx.user,
      roles: userCtx.roles,
      permissions: userCtx.permissions,
      teamMemberIds: userCtx.teamMemberIds,
    };
  }
}
