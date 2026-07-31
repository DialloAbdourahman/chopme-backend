import 'dotenv/config';

export interface EnvConfig {
  mongodbUri: string;
  port: number;
  allowedOrigins: string;

  adminEmail: string;
  adminPassword: string;

  accessTokenSecret: string;
  refreshTokenSecret: string;

  accessTokenDurationMins: number;
  refreshTokenDurationMins: number;

  googleClientId: string;
  googleClientSecret: string;
  googleRedirectLink: string;

  s3PublicBucketName: string;
  s3PublicBucketRegion: string;

  maxRestaurantImages: number;
  maxRestaurantImageSizeInMb: number;

  platformPercentage: number;
  collectionPercentage: number;
  disbursementPercentage: number;
  roundToNearestFCFA: number;

  maxTimeToPayOrderInMins: number;

  flutterWaveUrl: string;
  flutterWaveClientSecretKey: string;
  flutterWaveClientPublicKey: string;
  flutterWaveRedirectUrl: string;
  flutterWaveMaxPaymentLinkValidityInHr: number;
  flutterWaveWebhookSecretHash: string;

  platformMobileMoneyAccountNumber: string;
  platformMobileMoneyNetworkType: string;
}

export const env: EnvConfig = {
  mongodbUri: process.env.MONGODB_URI!,
  port: Number(process.env.PORT ?? 3000),
  allowedOrigins: process.env.ALLOWED_ORIGINS!,

  adminEmail: process.env.ADMIN_EMAIL!,
  adminPassword: process.env.ADMIN_PASSWORD!,

  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET!,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET!,

  accessTokenDurationMins: Number(process.env.ACCESS_TOKEN_DURATION_MINS),
  refreshTokenDurationMins: Number(process.env.REFRESH_TOKEN_DURATION_MINS),

  googleClientId: process.env.GOOGLE_CLIENT_ID!,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  googleRedirectLink: process.env.GOOGLE_REDIRECT_LINK!,

  s3PublicBucketName: process.env.S3_PUBLIC_BUCKET_NAME!,
  s3PublicBucketRegion: process.env.S3_PRIVATE_BUCKET_REGION!,

  maxRestaurantImages: Number(process.env.MAX_RESTAURANT_IMAGES),
  maxRestaurantImageSizeInMb: Number(
    process.env.MAX_RESTAURANT_IMAGE_SIZE_IN_MB,
  ),

  platformPercentage: Number(process.env.PLATFORM_PERCENTAGE),
  collectionPercentage: Number(process.env.COLLECTION_PERCENTAGE),
  disbursementPercentage: Number(process.env.DISBURSEMENT_PERCENTAGE),
  roundToNearestFCFA: Number(process.env.ROUND_TO_NEAREST_FCFA),

  maxTimeToPayOrderInMins: Number(process.env.MAX_TIME_TO_PAY_ORDER_IN_MINS),

  flutterWaveUrl: process.env.FLUTTER_WAVE_URL!,
  flutterWaveClientPublicKey: process.env.FLUTTER_WAVE_CLIENT_PUBLIC!,
  flutterWaveClientSecretKey: process.env.FLUTTER_WAVE_CLIENT_SECRET!,
  flutterWaveRedirectUrl: process.env.FLUTTER_WAVE_REDIRECT_URL!,
  flutterWaveMaxPaymentLinkValidityInHr: Number(
    process.env.FLUTTER_WAVE_MAX_PAYMENT_LINK_VALIDITY_IN_HR!,
  ),
  flutterWaveWebhookSecretHash: process.env.FLUTTER_WAVE_WEBHOOK_SECRET_HASH!,

  platformMobileMoneyAccountNumber:
    process.env.PLATFORM_MOBILE_MONEY_ACCOUNT_NUMBER!,
  platformMobileMoneyNetworkType:
    process.env.PLATFORM_MOBILE_MONEY_NETWORK_TYPE!,
};
