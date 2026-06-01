// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../guards/auth.guard';
import { ILoggedInUserTokenData } from '../interfaces/loggedin-user-token-data';

export const CurrentUser = createParamDecorator(
  (data: keyof ILoggedInUserTokenData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return data ? request.user[data] : request.user;
  },
);
