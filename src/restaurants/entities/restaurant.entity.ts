import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { EnumNetwork } from 'src/common/enums/networks';
import { EnumRestaurantType } from 'src/common/enums/restaurant-types';
import { EnumWalletTypes } from 'src/common/enums/wallet-types';
import { BaseSchema } from 'src/common/schemas/base.schema';

export type RestaurantDocument = HydratedDocument<Restaurant>;

@Schema({ _id: false })
export class Wallet {
  @Prop({ type: String, enum: EnumWalletTypes, required: true })
  type: EnumWalletTypes;

  @Prop({
    type: {
      network: { type: String, enum: EnumNetwork, required: true },
      number: { type: String, required: true },
    },
    _id: false,
    required: false,
  })
  mobileData?: {
    network: EnumNetwork;
    number: string;
  };
}

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

  @Prop({ enum: EnumRestaurantType, type: String })
  type: EnumRestaurantType;

  @Prop({
    type: {
      country: { type: String, required: true },
      city: { type: String, required: true },
      countryCode: { type: String, required: true },
      state: { type: String, required: false },
      longName: { type: String, required: false },
    },
    _id: false,
    required: true,
  })
  address: {
    country: string;
    city: string;
    countryCode: string;
    state?: string;
    longName?: string;
  };

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  location: {
    type: string;
    coordinates: number[];
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

  @Prop({ required: false })
  coverImage?: string;

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

  @Prop({ type: Boolean, default: true })
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

  @Prop({ type: Wallet, required: false, _id: false })
  wallet?: Wallet;
}

export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);

RestaurantSchema.index({ location: '2dsphere' });

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
