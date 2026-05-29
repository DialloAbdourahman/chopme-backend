import 'dotenv/config';

export interface EnvConfig {
  mongodbUri: string;
  port: number;

  accessTokenSecret: string;
  refreshTokenSecret: string;

  accessTokenDurationMins: number;
  refreshTokenDurationMins: number;
}

export const env: EnvConfig = {
  mongodbUri: process.env.MONGODB_URI!,
  port: Number(process.env.PORT ?? 3000),

  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET!,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET!,

  accessTokenDurationMins: Number(process.env.ACCESS_TOKEN_DURATION_MINS ?? 15),
  refreshTokenDurationMins: Number(
    process.env.REFRESH_TOKEN_DURATION_MINS ?? 60,
  ),
};
