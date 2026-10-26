// Trigger deployment - auth-service
import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { connectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import authRoutes from './routes/auth.routes.js';

const log = createLogger('auth-service');
const app: Express = express();
const PORT = process.env.AUTH_SERVICE_PORT ?? 4001;

// ---- Middleware ----
app.use(helmet());
const staticAllowed = [
  'http://localhost:4000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://e-shophy-admin.vercel.app',
  'https://e-shophy-ui.vercel.app',
  'https://e-comm-three-eta.vercel.app',
  'https://e-comm-admin-gules.vercel.app',
];
const envAllowed = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);

const authCors = cors({
  origin: (requestOrigin, callback) => {
    if (!requestOrigin) return callback(null, true);
    if (staticAllowed.includes(requestOrigin) || envAllowed.includes(requestOrigin)) return callback(null, true);
    try {
      const { hostname } = new URL(requestOrigin);
      if (hostname.endsWith('.vercel.app') || hostname === 'localhost' || hostname === '127.0.0.1') {
        return callback(null, true);
      }
    } catch {
      // Malformed origin
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200,
});

app.use(authCors);
app.options('*', authCors);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ---- Routes ----
app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Auth service running successfully',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRoutes);

// Admin routes (forwarded by gateway preserving path)
app.use('/api/v1/admin', authRoutes);

// ---- Error handler ----
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  log.error({ err, path: req.url }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred.'
          : err.message,
    },
  });
});

const DEFAULT_MONGODB_URI =
  'mongodb+srv://ornateinteriord:22k3ZVbQMZDpybDP@cluster0.plzr559.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// ---- Start ----
async function start(): Promise<void> {
  try {
    await connectDB(
      process.env.MONGODB_URI ?? DEFAULT_MONGODB_URI,
      process.env.AUTH_DB_NAME ?? 'ornate_auth',
      { exitOnError: false, maxRetries: 2, serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 },
    );
  } catch (err) {
    log.error({ err }, 'MongoDB connection warning - will retry on demand');
  }

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
      log.info({ port: PORT }, 'Auth service listening');
    });
  }
}

start();

export default app;
