import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL_UNPOOLED is not set in the .env file');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts', // Your schema file path
  out: './drizzle', // Your migrations folder
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});