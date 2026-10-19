import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { connectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import authRoutes from './routes/auth.routes.js';

const log = createLogger('auth-service');
const app = express();
const PORT = process.env.AUTH_SERVICE_PORT ?? 4001;

// ---- Middleware ----
app.use(helmet());
app.use(
  cors({
    origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:4000').split(',').map((o) => o.trim()),
    credentials: true,
  }),
);
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
app.get('/health', (_req, res) => {
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

// ---- Start ----
async function start(): Promise<void> {
  await connectDB(
    process.env.MONGODB_URI ?? 'mongodb://localhost:27017',
    process.env.AUTH_DB_NAME ?? 'ornate_auth',
  );
  app.listen(PORT, () => {
    log.info({ port: PORT }, 'Auth service listening');
  });
}

start().catch((err) => {
  log.error({ err }, 'Failed to start auth service');
  process.exit(1);
});

export default app;
