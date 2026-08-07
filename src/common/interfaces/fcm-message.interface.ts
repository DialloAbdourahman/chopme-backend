export interface IFcmNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface IFcmSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
}
