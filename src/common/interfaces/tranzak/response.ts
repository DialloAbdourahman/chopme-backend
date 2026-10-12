import { EnumTranzakEventType } from 'src/common/enums/tranzak/event-type';

export interface ITranzakApiResponse<T> {
  data: T;
  success: true;
  errorMsg?: string;
  errorCode?: number;
}

export interface ITranzakWebhookResponse<T> {
  name: string;
  version: string;
  eventType: EnumTranzakEventType;
  merchantId: string;
  appId: string;
  resourceId: string;
  resource: T;
  creationDateTime: string;
  webhookId: string;
  authKey: string;
}
