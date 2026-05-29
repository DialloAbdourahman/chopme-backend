import { EnumStatusCode } from '../enums/response-status-code';
import { EnumStatusResponse } from '../enums/status-response';

export class OrchestrationResult<T = unknown> {
  readonly code: EnumStatusResponse;
  readonly statusCode: EnumStatusCode;
  readonly message: string | null;
  readonly data: T | null;

  private constructor(input: {
    data: T | null;
    statusCode: EnumStatusCode;
    message: string | null;
    code: EnumStatusResponse;
  }) {
    this.code = input.code;
    this.statusCode = input.statusCode;
    this.message = input.message || null;
    this.data = input.data || null;
  }

  // ✅ Success
  static Success<T>(input: {
    statusCode: EnumStatusCode;
    data: T;
    message?: string | null;
  }): OrchestrationResult<T> {
    return new OrchestrationResult<T>({
      data: input.data,
      statusCode: input.statusCode,
      code: EnumStatusResponse.SUCCESS,
      message: input.message ?? null,
    });
  }

  // ❌ Failure
  static Failure<T>(input: {
    message: string;
    statusCode: EnumStatusCode;
    data?: T | null;
  }): OrchestrationResult<T> {
    return new OrchestrationResult<T>({
      message: input.message,
      statusCode: input.statusCode,
      code: EnumStatusResponse.FAILURE,
      data: input.data ?? null,
    });
  }

  // 🔍 Helpers
  isSuccess(): boolean {
    return this.code === EnumStatusResponse.SUCCESS;
  }

  isFailure(): boolean {
    return this.code === EnumStatusResponse.FAILURE;
  }
}
