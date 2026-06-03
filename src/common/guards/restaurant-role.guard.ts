import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EnumRestaurantMemberRole } from '../enums/restaurant-member-role';
import { OrchestrationException } from '../exceptions/orchestration.exception';
import { EnumStatusCode } from '../enums/response-status-code';
import { AuthenticatedRequest } from './auth.guard';

export const RESTAURANT_ROLES_KEY = 'restaurantRoles';
export const RestaurantRoles = (...roles: EnumRestaurantMemberRole[]) =>
  SetMetadata(RESTAURANT_ROLES_KEY, roles);

@Injectable()
export class RestaurantRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      EnumRestaurantMemberRole[]
    >(RESTAURANT_ROLES_KEY, [context.getHandler(), context.getClass()]);

    // If no restaurant roles are specified, allow access (AuthGuard already enforced auth)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    const userRestaurantRole = user.restaurantMemberRole as
      | EnumRestaurantMemberRole
      | undefined;

    const hasRole = !!userRestaurantRole
      ? requiredRoles.includes(userRestaurantRole)
      : false;

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
