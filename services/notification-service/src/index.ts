// Trigger deployment - notification-service
import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import notificationRoutes from './routes/notification.routes.js';

const log = createLogger('notification-service');
const app: Express = express();
const PORT = process.env.NOTIFICATION_SERVICE_PORT ?? 4010;

app.use(helmet());
const staticAllowed = [
  'http://localhost:4000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'https://e-shopy-admin.vercel.app',
  'https://e-shopy-ui.vercel.app',
  'https://e-shophy-admin.vercel.app',
  'https://e-shophy-ui.vercel.app',
  'https://e-comm-three-eta.vercel.app',
  'https://e-comm-admin-gules.vercel.app',
  'https://admin.eshopy.biz',
  'https://store.eshopy.biz',
  'https://vendor.eshopy.biz',
  'https://www.eshopy.biz',
  'https://eshopy.biz',
];
const envAllowed = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const ESHOPY_SUBDOMAIN_REGEX = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*eshopy\.biz(?::\d+)?$/i;
const VERCEL_SUBDOMAIN_REGEX = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*vercel\.app(?::\d+)?$/i;
const LOCALHOST_REGEX = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;
  const cleanOrigin = origin.trim().replace(/\/+$/, '');
  if (staticAllowed.includes(cleanOrigin) || envAllowed.includes(cleanOrigin)) return true;
  if (ESHOPY_SUBDOMAIN_REGEX.test(cleanOrigin)) return true;
  if (VERCEL_SUBDOMAIN_REGEX.test(cleanOrigin)) return true;
  if (LOCALHOST_REGEX.test(cleanOrigin)) return true;
  try {
    const { hostname } = new URL(cleanOrigin);
    if (hostname.endsWith('.eshopy.biz') || hostname === 'eshopy.biz') return true;
    if (hostname.endsWith('.vercel.app')) return true;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  } catch {}
  return false;
};

app.use((req: Request, res: Response, next) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    const cleanOrigin = origin.trim().replace(/\/+$/, '');
    res.setHeader('Access-Control-Allow-Origin', cleanOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] ||
        'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cookie, X-CSRF-Token, x-session-id, X-Client-Type, x-client-type, Cache-Control, Pragma, Expires, x-store-id, X-Store-Id',
    );
    res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

const notificationCors = cors({
  origin: (requestOrigin, callback) => {
    if (!requestOrigin) return callback(null, true);
    const cleanOrigin = requestOrigin.trim().replace(/\/+$/, '');
    if (isOriginAllowed(cleanOrigin)) return callback(null, cleanOrigin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cookie',
    'X-CSRF-Token',
    'x-session-id',
    'X-Client-Type',
    'x-client-type',
    'Cache-Control',
    'Pragma',
    'Expires',
    'x-store-id',
    'X-Store-Id',
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200,
});

app.use(notificationCors);
app.options('*', notificationCors);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Health check & Root
app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Notification service running successfully',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() });
});

// Mounted paths
app.use('/api/v1/notifications', notificationRoutes);
app.use('/notifications', notificationRoutes);


// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  log.error({ err, path: req.url }, 'Unhandled error in notification service');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
    },
  });
});

async function start(): Promise<void> {
  try {
    await connectDB(
      process.env.MONGODB_URI || '',
      process.env.NOTIFICATION_DB_NAME ?? 'ornate_notifications',
      { exitOnError: false, maxRetries: 2, serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 },
    );
  } catch (err) {
    log.error({ err }, 'MongoDB connection warning - will retry on demand');
  }

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
      log.info({ port: PORT }, 'Notification service listening');
    });
  }
}

start();

export default app;
