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

// Test everything and add a webhook. Also add a webhook field on the order so we can save some data.

// Round up on basic routes like get public client info from order (by restaurant), get orders (client, restaurant and admin), client cancel created order.

// Add a route on the client module to update thier information e.g phone number for now with the exact same dto validation as the payOrder.

// Add route that will allow the restaurant to cancel an order and work on the webhook.
