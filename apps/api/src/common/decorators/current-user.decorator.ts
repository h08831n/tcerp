import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SecurityContext } from '../../modules/iam/permission.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SecurityContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.userContext;
  }
);
