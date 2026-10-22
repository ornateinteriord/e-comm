import mongoose from 'mongoose';
import { createLogger } from '@ornate/logger';

const log = createLogger('db');

let isConnected = false;
let listenersAttached = false;

export interface ConnectDBOptions {
  maxRetries?: number;
  serverSelectionTimeoutMS?: number;
  connectTimeoutMS?: number;
  socketTimeoutMS?: number;
  maxPoolSize?: number;
  minPoolSize?: number;
  exitOnError?: boolean;
}

function isNetworkOrWhitelistError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('whitelist') ||
    msg.includes('ReplicaSetNoPrimary') ||
    msg.includes('serverSelectionTimeoutMS') ||
    msg.includes('querySrv') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ECONNREFUSED')
  );
}

function printAtlasDiagnosticBox(dbName: string, uri: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  // Mask password in URI for logging
  const maskedUri = uri.replace(/\/\/[^:]+:([^@]+)@/, '//***:***@');

  console.error('\n' + '='.repeat(78));
  console.error('[MongoDB] ALL CONNECTION ATTEMPTS FAILED');
  console.error(`Target Database : ${dbName}`);
  console.error(`Cluster URI     : ${maskedUri}`);
  console.error(`Root Cause      : ${msg}`);
  console.error('-'.repeat(78));
  console.error('PROBABLE CAUSE: MongoDB Atlas IP Access List (Whitelist) or Network Timeout');
  console.error('Atlas blocks connections from any IP that is not explicitly whitelisted.');
  console.error('\nHOW TO RESOLVE IN MONGODB ATLAS:');
  console.error('  1. Open MongoDB Atlas: https://cloud.mongodb.com');
  console.error('  2. In the left navigation sidebar under "Security", click "Network Access"');
  console.error('  3. Click the "+ ADD IP ADDRESS" button');
  console.error('  4. For seamless development, click "ALLOW ACCESS FROM ANYWHERE" (0.0.0.0/0)');
  console.error('     (Or click "ADD CURRENT IP ADDRESS" to whitelist your current network only)');
  console.error('  5. Click "Confirm" and wait 1-2 minutes for Atlas to propagate the changes.');
  console.error('\nALTERNATIVE (LOCAL MONGODB):');
  console.error('  Set MONGODB_URI=mongodb://localhost:27017 in your .env file to run locally.');
  console.error('='.repeat(78) + '\n');
}

function setupListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    log.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    log.info('MongoDB reconnected');
  });

  mongoose.connection.on('error', (err: unknown) => {
    log.error({ err }, 'MongoDB runtime error');
  });
}

function prepareUri(rawUri: string): string {
  let uri = rawUri.trim();
  // Ensure mongodb+srv URIs have retryWrites & w=majority if no query params present
  if (uri.startsWith('mongodb+srv://') && !uri.includes('?')) {
    uri = `${uri.replace(/\/$/, '')}/?retryWrites=true&w=majority`;
  }
  return uri;
}

export async function connectDB(
  rawUri: string,
  dbName: string,
  options?: ConnectDBOptions,
): Promise<void> {
  if (isConnected) return;

  const uri = prepareUri(rawUri);
  const maxRetries = options?.maxRetries ?? Number(process.env.MONGODB_MAX_RETRIES ?? 5);
  const serverSelectionTimeoutMS =
    options?.serverSelectionTimeoutMS ??
    Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 30000);
  const connectTimeoutMS =
    options?.connectTimeoutMS ?? Number(process.env.MONGODB_CONNECT_TIMEOUT_MS ?? 30000);
  const socketTimeoutMS =
    options?.socketTimeoutMS ?? Number(process.env.MONGODB_SOCKET_TIMEOUT_MS ?? 45000);
  const maxPoolSize = options?.maxPoolSize ?? Number(process.env.MONGODB_MAX_POOL_SIZE ?? 10);
  const minPoolSize = options?.minPoolSize ?? Number(process.env.MONGODB_MIN_POOL_SIZE ?? 1);
  const exitOnError = options?.exitOnError ?? (process.env.NODE_ENV !== 'test');

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        log.info({ dbName, attempt, maxRetries }, 'Retrying MongoDB connection...');
      }

      await mongoose.connect(uri, {
        dbName,
        maxPoolSize,
        minPoolSize,
        serverSelectionTimeoutMS,
        connectTimeoutMS,
        socketTimeoutMS,
        retryWrites: true,
        w: 'majority',
      });

      isConnected = true;
      log.info({ dbName, attempt }, 'MongoDB connected successfully');
      setupListeners();
      return;
    } catch (err: unknown) {
      lastError = err;
      const isLastAttempt = attempt >= maxRetries;
      const isWhitelistOrNet = isNetworkOrWhitelistError(err);

      if (!isLastAttempt) {
        const delayMs = Math.min(2000 * Math.pow(1.5, attempt - 1), 10000);
        log.warn(
          {
            dbName,
            attempt,
            maxRetries,
            nextRetryInMs: delayMs,
            isWhitelistOrNet,
            err: err instanceof Error ? err.message : String(err),
          },
          `MongoDB connection attempt ${attempt}/${maxRetries} failed. Retrying in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // Optional fallback connection
  const fallbackUri = process.env.MONGODB_FALLBACK_URI;
  if (fallbackUri && fallbackUri !== rawUri) {
    try {
      log.warn({ fallbackUri, dbName }, 'Primary MongoDB connection failed. Trying MONGODB_FALLBACK_URI...');
      await mongoose.connect(prepareUri(fallbackUri), {
        dbName,
        maxPoolSize,
        minPoolSize,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      isConnected = true;
      log.info({ dbName }, 'MongoDB connected successfully via fallback URI');
      setupListeners();
      return;
    } catch (fallbackErr) {
      log.error({ fallbackErr }, 'Fallback MongoDB connection also failed');
    }
  }

  // All attempts exhausted
  printAtlasDiagnosticBox(dbName, uri, lastError);
  log.error({ err: lastError, dbName, maxRetries }, 'MongoDB connection failed after all retries');

  if (exitOnError) {
    process.exit(1);
  } else {
    throw lastError;
  }
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  log.info('MongoDB disconnected cleanly');
}

export { mongoose };
export * from 'mongoose';
