import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { AuthenticatedRequest } from '../guards/auth.guard';

@Injectable()
export class LogUserRequestInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LogUserRequestInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // const request = context.switchToHttp().getRequest<Request>();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user! as ILoggedInUserTokenData | undefined;
    const route = `${request.method} ${request.path}`;

    this.logger.log(
      `[UserRequest] route=${route} user=${JSON.stringify(user || null)}`,
    );

    return next.handle();
  }
}
