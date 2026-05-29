import { HttpException } from '@nestjs/common';
import { EnumStatusCode } from '../enums/response-status-code';

export class OrchestrationException extends HttpException {
  readonly code: number;
  readonly statusCode: EnumStatusCode;

  constructor({
    code = 400,
    message,
    statusCode = EnumStatusCode.INTERNAL_SERVER_ERROR,
  }: {
    statusCode: EnumStatusCode;
    message: string;
    code?: number;
  }) {
    super(message, code);
    this.statusCode = statusCode;
    this.code = code;
  }
}
