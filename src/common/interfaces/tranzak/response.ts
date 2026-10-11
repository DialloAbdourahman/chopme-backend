export interface ITranzakApiResponse<T> {
  data: T;
  success: true;
  errorMsg?: string;
  errorCode?: number;
}
