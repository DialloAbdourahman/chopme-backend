import { EnumNotificationType } from '../enums/notification-type';

export interface INotification<T> {
  type: EnumNotificationType;
  data: T;
}
