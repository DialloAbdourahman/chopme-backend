import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { OrchestrationExceptionFilter } from './common/filters/exception.filter';
import { env } from './config/env';
import { createValidationPipe } from './common/pipes/validation-pipe';
import { LogUserRequestInterceptor } from './common/interceptors/log-user-request.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [env.clientFrontendUrl, env.restaurantFrontendUrl],
    credentials: true,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new OrchestrationExceptionFilter());
  app.useGlobalInterceptors(new LogUserRequestInterceptor());

  await app.listen(env.port);
}
bootstrap();
