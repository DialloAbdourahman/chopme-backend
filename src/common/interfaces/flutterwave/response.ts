export interface FlutterWaveResponse<T> {
  status: 'success' | 'failed';
  message: string;
  data: T;
  error?: {
    type: string;
    code: string;
    message: string;
    validation_errors: string[];
  };
}
