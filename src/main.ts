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

// New route that will allow a restaurant manager to get all his restaurant members.

// @restaurant-members.controller.ts another route that will allow the restaurant mangaer to search for the restaurant members and it should be pagingated just like the route @restaurants.controller.ts#L57-61 but ti will take the pgaingation from the request query.
// It should also teak in a search attribute from the request query and it should search against the user.fullName, user.email.

// It should also take in a role in the request query to filer

// New route in users module to allow the user to update their password.

// Try to look at the menu category as it is done in ubereats and see if we should not allow the restaurant to create their categories.

// Continue on the delete, upload/delete cover and pictures.

// Add an order count on the menu and totalViews (plus the route to view).
