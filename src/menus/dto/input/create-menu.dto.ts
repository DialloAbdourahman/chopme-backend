import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';
import { env } from '../../../config/env';

function IsDivisibleBy(divisor: number, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isDivisibleBy',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [divisor],
      options: validationOptions,
      validator: {
        validate(value: any) {
          return typeof value === 'number' && value % divisor === 0;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be divisible by ${args.constraints[0]}`;
        },
      },
    });
  };
}

export class CreateMenuDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsMongoId()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Type(() => Number)
  @Min(env.roundToNearestFCFA)
  @IsDivisibleBy(env.roundToNearestFCFA, {
    message: `Price must be divisible by ${env.roundToNearestFCFA}`,
  })
  price: number;

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  available?: boolean;
}
