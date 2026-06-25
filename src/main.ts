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

// When saving the total price of an item to be collected, save the calculatedRoundedToTheNearest50FCFA multiplied by the amount. Not the real price multiplied by the amount then the the nesrest machin truc. Also think of maybe storing the delivery price and nearest machin truc percentage based on just the collection and disburement percentage this time around. Maybe also store the absorbed rounded price for the proucts and the delivery price.
// Add a route on the client module that will allow them to update their information like phone number and maybe add more. Also check if the added attributes should be used as a required check on the ensureCanOrder.
