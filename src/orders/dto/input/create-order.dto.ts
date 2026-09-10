import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { RestaurantLocationDto } from 'src/restaurants/dto/input/create-restaurant.dto';

export class OrderItemDto {
  @IsString()
  @IsMongoId()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsMongoId()
  restaurantId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ValidateNested()
  @Type(() => RestaurantLocationDto)
  clientLocation: RestaurantLocationDto;
}
