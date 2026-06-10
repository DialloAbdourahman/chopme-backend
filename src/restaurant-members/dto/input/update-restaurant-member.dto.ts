import { PartialType } from '@nestjs/mapped-types';
import { CreateRestaurantMemberDto } from './create-restaurant-member.dto';

export class UpdateRestaurantMemberDto extends PartialType(CreateRestaurantMemberDto) {}
