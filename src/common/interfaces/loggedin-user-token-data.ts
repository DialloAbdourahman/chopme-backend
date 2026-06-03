import { EnumRestaurantMemberRole } from '../enums/restaurant-member-role';
import { EnumUserRole } from '../enums/user-roles';

export interface ILoggedInUserTokenData {
  id: string;
  email: string;
  role: EnumUserRole;
  clientId?: string;
  restaurantId?: string;
  restaurantMemberId?: string;
  restaurantMemberRole?: EnumRestaurantMemberRole;
}
