import 'dotenv/config';

export interface EnvConfig {
  mongodbUri: string;
  port: number;
  allowedOrigins: string;

  accessTokenSecret: string;
  refreshTokenSecret: string;

  accessTokenDurationMins: number;
  refreshTokenDurationMins: number;

  googleClientId: string;
  googleClientSecret: string;
  googleRedirectLink: string;

  s3BucketName: string;
  s3BucketRegion: string;

  maxRestaurantImages: number;
  maxRestaurantImageSizeInMb: number;
}

export const env: EnvConfig = {
  mongodbUri: process.env.MONGODB_URI!,
  port: Number(process.env.PORT ?? 3000),
  allowedOrigins: process.env.ALLOWED_ORIGINS!,

  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET!,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET!,

  accessTokenDurationMins: Number(process.env.ACCESS_TOKEN_DURATION_MINS ?? 15),
  refreshTokenDurationMins: Number(
    process.env.REFRESH_TOKEN_DURATION_MINS ?? 60,
  ),

  googleClientId: process.env.GOOGLE_CLIENT_ID!,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  googleRedirectLink: process.env.GOOGLE_REDIRECT_LINK!,

  s3BucketName: process.env.S3_BUCKET_NAME!,
  s3BucketRegion: process.env.S3_BUCKET_REGION!,

  maxRestaurantImages: Number(process.env.MAX_RESTAURANT_IMAGES ?? 10),
  maxRestaurantImageSizeInMb: Number(
    process.env.MAX_RESTAURANT_IMAGE_SIZE_IN_MB ?? 5,
  ),
};
