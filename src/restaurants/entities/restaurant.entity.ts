import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { EnumCities } from 'src/common/enums/cities';
import { EnumCountries } from 'src/common/enums/countries';

export type RestaurantDocument = HydratedDocument<Restaurant>;

@Schema({ timestamps: true })
export class Restaurant extends BaseSchema {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: false, unique: true })
  slug: string;

  @Prop({ required: false })
  slogan?: string;

  @Prop({ required: false })
  description?: string;

  @Prop({ required: false })
  phone?: string;

  @Prop({ required: false })
  email?: string;

  @Prop({
    type: {
      country: { type: String, enum: EnumCountries, required: true },
      city: { type: String, enum: EnumCities, required: true },
      longitude: { type: Number, required: true },
      latitude: { type: Number, required: true },
    },
    _id: false,
    required: true,
  })
  address: {
    country: EnumCountries;
    city: EnumCities;
    longitude: number;
    latitude: number;
  };

  @Prop({
    type: {
      average: { type: Number },
      total: { type: Number },
    },
    _id: false,
    default: {
      average: 0,
      total: 0,
    },
  })
  rating: {
    average: number;
    total: number;
  };

  @Prop({ default: 0 })
  totalViews: number;

  @Prop({ type: [String], default: [] })
  pictures: string[];

  @Prop({
    type: [
      {
        from: { type: Number },
        to: { type: Number },
        price: { type: Number },
      },
    ],
    _id: false,
    default: [],
  })
  deliveryPricingKm: {
    from: number;
    to: number;
    price: number;
  }[];

  @Prop({ type: Boolean, default: false })
  isClosed: boolean;

  @Prop({
    type: [
      {
        day: { type: String },
        openTime: { type: String },
        closeTime: { type: String },
      },
    ],
    _id: false,
    default: [],
  })
  availability: {
    day: string;
    openTime: string;
    closeTime: string;
  }[];
}

export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);

RestaurantSchema.pre<RestaurantDocument>('save', function () {
  if (!this.isModified('name') && this.slug) {
    return;
  }

  const slug = this.name
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  this.slug = slug;
});
