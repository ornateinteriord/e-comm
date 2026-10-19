import mongoose from 'mongoose';
import { createLogger } from '@ornate/logger';

const log = createLogger('db');

let isConnected = false;

export async function connectDB(uri: string, dbName: string): Promise<void> {
  if (isConnected) return;

  try {
    await mongoose.connect(uri, {
      dbName,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    log.info({ dbName }, 'MongoDB connected');
  } catch (err) {
    log.error({ err }, 'MongoDB connection failed');
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    log.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    log.error({ err }, 'MongoDB error');
  });
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  log.info('MongoDB disconnected cleanly');
}

export { mongoose };
export * from 'mongoose';
