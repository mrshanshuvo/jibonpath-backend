import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const parseOrigins = (raw?: string): string[] => {
  if (!raw) return [];
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const envConfig = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  corsOrigins: Array.from(
    new Set([
      ...parseOrigins(process.env.CORS_ORIGINS),
      ...parseOrigins(process.env.CLIENT_URL),
      "http://localhost:3000",
    ]),
  ),
  docsUrl:
    process.env.DOCS_URL ||
    "https://documenter.getpostman.com/view/47434753/2sBYAvvATP",
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET || "your-jwt-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "your-jwt-refresh-secret",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ||
      "http://localhost:5000/api/v1/auth/google/callback",
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  },
  bkash: {
    baseUrl:
      process.env.BKASH_BASE_URL ||
      "https://tokenized.sandbox.bka.sh/v1.2.0-beta",
    appKey: process.env.BKASH_APP_KEY || "",
    appSecret: process.env.BKASH_APP_SECRET || "",
    username: process.env.BKASH_USERNAME || "",
    password: process.env.BKASH_PASSWORD || "",
    callbackUrl:
      process.env.BKASH_CALLBACK_URL ||
      "http://localhost:5000/api/v1/payments/bkash/callback",
  },
  sslcommerz: {
    storeId: process.env.SSLCOMMERZ_STORE_ID || "emerg6a993ce356e43",
    storePassword:
      process.env.SSLCOMMERZ_STORE_PASSWORD || "emerg6a993ce356e43@ssl",
    isLive: process.env.SSLCOMMERZ_IS_LIVE === "true",
    sessionUrl:
      process.env.SSLCOMMERZ_SESSION_URL ||
      "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
    validationUrl:
      process.env.SSLCOMMERZ_VALIDATION_URL ||
      "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php",
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },
  redis: {
    url:
      process.env.REDIS_URL ||
      (process.env.REDIS_HOST
        ? `redis://${process.env.REDIS_USERNAME || "default"}:${process.env.REDIS_PASSWORD || ""}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
        : ""),
    host: process.env.REDIS_HOST || "",
    port: Number(process.env.REDIS_PORT) || 6379,
    username: process.env.REDIS_USERNAME || "default",
    password: process.env.REDIS_PASSWORD || "",
  },
} as const;
