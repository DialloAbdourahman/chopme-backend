import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MenusService } from './menus.service';
import { MenusController } from './menus.controller';
import { Menu, MenuSchema } from './entities/menu.entity';
import {
  Category,
  CategorySchema,
} from 'src/categories/entities/category.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Menu.name, schema: MenuSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [MenusController],
  providers: [MenusService],
})
export class MenusModule {}
