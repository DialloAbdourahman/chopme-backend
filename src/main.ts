import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { OrchestrationExceptionFilter } from './common/filters/exception.filter';
import { env } from './config/env';
import { stringToArray } from './common/utils/string-to-array';
import { createValidationPipe } from './common/pipes/validation-pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: stringToArray(env.allowedOrigins),
    credentials: true,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new OrchestrationExceptionFilter());

  await app.listen(env.port);
}
bootstrap();
