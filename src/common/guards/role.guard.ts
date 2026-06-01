import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EnumUserRole } from '../enums/user-roles';
import { OrchestrationException } from '../exceptions/orchestration.exception';
import { EnumStatusCode } from '../enums/response-status-code';
import { AuthenticatedRequest } from './auth.guard';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: EnumUserRole[]) =>
  SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<EnumUserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are specified, allow access (AuthGuard already enforced auth)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    const hasRole = requiredRoles.includes(user.role as EnumUserRole);

    if (!hasRole) {
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_ALLOWED,
        message: 'You do not have permission to perform this action',
        code: 403,
      });
    }

    return true;
  }
}
