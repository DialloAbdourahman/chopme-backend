import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { OrchestrationExceptionFilter } from './common/filters/exception.filter';
import { env } from './config/env';
import { stringToArray } from './common/utils/string-to-array';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: stringToArray(env.allowedOrigins),
    credentials: true,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.useGlobalFilters(new OrchestrationExceptionFilter());

  await app.listen(env.port);
}
bootstrap();

// Add isOwner bool attribute on restaurant member.

// New restaurant member route that will allow the owner to delete a member (use the isOwner attribute, should not be able to delete owner.)

// Another route that will allow a manager to update the role of a restaurant member (not be able to update the isOwner.)

// New route in users module to allow the user to update their password.

// Try to look at the menu category as it is done in ubereats and see if we should not allow the restaurant to create their categories.

// Continue on the delete, upload/delete cover and pictures.

// Add an order count on the menu and totalViews (plus the route to view).
