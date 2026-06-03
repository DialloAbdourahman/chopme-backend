import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { OrchestrationException } from '../exceptions/orchestration.exception';
import { EnumStatusResponse } from '../enums/status-response';
import { EnumStatusCode } from '../enums/response-status-code';

@Catch()
export class OrchestrationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OrchestrationExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    console.log(exception);

    // 🎯 Case 1 — Our custom OrchestrationException
    if (exception instanceof OrchestrationException) {
      this.logger.warn(
        `[OrchestrationException] ${request.method} ${request.url} — ${exception.message}`,
      );
      return response.status(exception.code).json({
        code: EnumStatusResponse.FAILURE,
        statusCode: exception.statusCode,
        message: exception.message,
        data: null,
      });
    }

    // 🎯 Case 2 — NestJS built-in HttpException (NotFoundException etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      this.logger.warn(
        `[HttpException] ${request.method} ${request.url} — ${exception.message}`,
      );

      return response.status(status).json({
        code: EnumStatusResponse.FAILURE,
        statusCode: EnumStatusCode.INTERNAL_SERVER_ERROR,
        message: exception.message,
        data: null,
      });
    }

    // 🎯 Case 3 — Unknown/unhandled errors — most important to log
    this.logger.error(
      `[UnhandledException] ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    return response.status(500).json({
      code: EnumStatusResponse.FAILURE,
      statusCode: EnumStatusCode.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      data: null,
    });
  }
}
