import { Module } from '@nestjs/common';
import { FlwWebhookService } from './flw-webhook.service';
import { FlwWebhookController } from './flw-webhook.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Menu, MenuSchema } from 'src/menus/entities/menu.entity';
import { Order, OrderSchema } from 'src/orders/entities/order.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Menu.name, schema: MenuSchema },
    ]),
  ],
  controllers: [FlwWebhookController],
  providers: [FlwWebhookService],
})
export class FlwWebhookModule {}
