import dotenv from 'dotenv';
dotenv.config();

const db_config = {
  SERVER_MODE: process.env.SERVER_MODE || 'DEV',
  SECRET_KEY: process.env.SECRET_KEY || 'tulshi_secret_key',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'tulshi_refresh_secret',
  DB: {
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: Number(process.env.DB_PORT) || 5432,
    DB_NAME: process.env.DB_NAME || 'tulshi_fashion',
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
  },
  R2: {
    R2_S3_API_URL: process.env.R2_S3_API_URL || '',
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
    R2_PUBLIC_BUCKET_NAME: process.env.R2_PUBLIC_BUCKET_NAME || '',
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || '',
  },
};

export default db_config;
