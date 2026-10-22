// Trigger deployment - user-service
import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { connectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import userRoutes from './routes/user.routes.js';
import {
  getProfile,
  updateProfile,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  adminListCustomers,
} from './controllers/user.controller.js';
import { attachUser, requireAuth, requireRole } from './middleware/auth.middleware.js';

const log = createLogger('user-service');
const app: Express = express();
const PORT = process.env.USER_SERVICE_PORT ?? 4002;

// ---- Middleware ----
app.use(helmet());
app.use(
  cors({
    origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:4000,http://localhost:5173').split(',').map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

app.use(attachUser);

// ---- Health & Root ----
app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'User service running successfully',
    service: 'user-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'user-service', timestamp: new Date().toISOString() });
});

// Mounted for direct router and proxy paths
app.use('/api/v1', userRoutes);

// Direct mapping for gateway forwarded sub-paths
app.get('/api/v1/users/me', requireAuth, getProfile);
app.get('/api/v1/users/profile', requireAuth, getProfile);
app.put('/api/v1/users/profile', requireAuth, updateProfile);

app.get('/api/v1/addresses', requireAuth, getAddresses);
app.post('/api/v1/addresses', requireAuth, createAddress);
app.put('/api/v1/addresses/:id', requireAuth, updateAddress);
app.delete('/api/v1/addresses/:id', requireAuth, deleteAddress);
app.patch('/api/v1/addresses/:id/default', requireAuth, setDefaultAddress);

app.get('/api/v1/wishlist', requireAuth, getWishlist);
app.post('/api/v1/wishlist', requireAuth, addToWishlist);
app.delete('/api/v1/wishlist/:productId', requireAuth, removeFromWishlist);

app.get('/api/v1/admin/customers', requireAuth, requireRole('support', 'admin', 'super_admin'), adminListCustomers);

// ---- Error handler ----
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  log.error({ err, path: req.url }, 'Unhandled error in user service');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
    },
  });
});

async function start(): Promise<void> {
  await connectDB(
    process.env.MONGODB_URI ?? 'mongodb://localhost:27017',
    process.env.USER_DB_NAME ?? 'ornate_users',
  );
  app.listen(PORT, () => {
    log.info({ port: PORT }, 'User service listening');
  });
}

start().catch((err) => {
  log.error({ err }, 'Failed to start user service');
  process.exit(1);
});

export default app;
