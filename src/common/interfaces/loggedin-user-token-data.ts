import { EnumUserRole } from '../enums/user-roles';

export interface LoggedInUserTokenData {
  id: string;
  email: string;
  role: EnumUserRole;
  clientId?: string;
  restaurantId?: string;
}
