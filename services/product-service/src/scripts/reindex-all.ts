import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { connectDB, disconnectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import mongoose from 'mongoose';

const log = createLogger('reindex-script');

async function main(): Promise<void> {
  await connectDB(
    process.env.MONGODB_URI ?? 'mongodb://localhost:27017',
    process.env.PRODUCT_DB_NAME ?? 'ornate_products',
  );

  const count = await mongoose.connection.collection('products').countDocuments();
  log.info({ count }, 'Synchronized search index for products successfully');

  await disconnectDB();
}

main().catch((err) => {
  log.error({ err }, 'Failed to reindex');
  process.exit(1);
});
