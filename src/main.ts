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

// Add order utils routes to reduce the amount of joins: Get client from order and then on the frontend use the route to get restaurant and menu to display the additional information.
// A client can cancel an order that is in created state.
// Add a route on the client module that will allow them to update their information like phone number and maybe add more. Also check if the added attributes should be used as a required check on the ensureCanOrder.

// {
//     "code": "SUCCESS",
//     "statusCode": "CREATED_SUCCESSFULLY",
//     "message": "Menu updated successfully",
//     "data": {
//         "id": "6a3ed130e73d960c968d4ac1",
//         "clientId": "6a3842e3bc503575612ad7c9",
//         "restaurantId": "6a2f156b4ae3760d440ef51a",
//         "status": "CREATED",
//         "items": [
//             {
//                 "productId": "6a3133a81eeffe9c07c5a072",
//                 "quantity": 3,
//                 "originalPrice": 4500
//             }
//         ],
//         "maxTimeToPayOrder": "2026-06-26T19:51:20.565Z",
//         "paidAt": null,
//         "createdAt": "2026-06-26T19:21:20.591Z",
//         "pricing": {
//             "totalAmountCollected": 16200,
//             "totalAmountCollectedWithDelivery": 18300,
//             "deliveryFeeAmountWithCollectionAndDisbursementPercentage": 2100
//         }
//     }
// }
