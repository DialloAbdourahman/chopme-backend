import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EnumMenuCategory } from 'src/common/enums/menu-category';

export class CreateMenuDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(EnumMenuCategory)
  category: EnumMenuCategory;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price: number;

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  available?: boolean;
}
