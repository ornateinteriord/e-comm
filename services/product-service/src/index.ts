// Trigger deployment - product-service (consolidated with inventory & search)
import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import productRoutes from './routes/product.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import searchRoutes from './routes/search.routes.js';
import {
  checkStock,
  reserveStock,
  deductStock,
  adminListInventory,
  adminAdjustStock,
  adminListMovements,
} from './controllers/inventory.controller.js';
import { attachUser, requireAuth, requireRole } from './middleware/auth.middleware.js';

const log = createLogger('product-service');
const app: Express = express();
const PORT = process.env.PRODUCT_SERVICE_PORT ?? 4003;

app.use(helmet());
const staticAllowed = [
  'http://localhost:4000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://admin.eshopy.biz',
  'https://www.eshopy.biz',
  'https://eshopy.biz',
];
const envAllowed = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) return callback(null, true);
      if (staticAllowed.includes(requestOrigin) || envAllowed.includes(requestOrigin)) return callback(null, true);
      try {
        const { hostname } = new URL(requestOrigin);
        if (
          hostname.endsWith('.vercel.app') ||
          hostname.endsWith('.eshopy.biz') ||
          hostname === 'eshopy.biz' ||
          hostname === 'localhost' ||
          hostname === '127.0.0.1'
        ) {
          return callback(null, true);
        }
      } catch {
        // ignore
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use(limiter);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Product & Catalog service running successfully',
    service: 'product-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok', service: 'product-service' }));

// Core product & category routes
app.use(productRoutes);

// Search routes
app.use('/api/v1/search', searchRoutes);
app.use('/search', searchRoutes);

// Inventory routes
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/inventory', inventoryRoutes);

// Direct mapping for gateway forwarded subpaths
app.use(attachUser);
app.post('/api/v1/inventory/check', checkStock);
app.post('/api/v1/inventory/reserve', reserveStock);
app.post('/api/v1/inventory/deduct', deductStock);

app.get('/api/v1/admin/inventory', requireAuth, requireRole('inventory_manager', 'admin', 'super_admin'), adminListInventory);
app.post('/api/v1/admin/inventory/adjust', requireAuth, requireRole('inventory_manager', 'admin', 'super_admin'), adminAdjustStock);
app.get('/api/v1/admin/inventory/movements', requireAuth, requireRole('inventory_manager', 'admin', 'super_admin'), adminListMovements);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  log.error({ err, path: req.url }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
    },
  });
});

const DEFAULT_MONGODB_URI =
  'mongodb+srv://ornateinteriord:22k3ZVbQMZDpybDP@cluster0.plzr559.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function start(): Promise<void> {
  try {
    await connectDB(
      process.env.MONGODB_URI ?? DEFAULT_MONGODB_URI,
      process.env.PRODUCT_DB_NAME ?? 'ornate_products',
      { exitOnError: false, maxRetries: 2, serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 },
    );
  } catch (err) {
    log.error({ err }, 'MongoDB connection warning - will retry on demand');
  }

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => log.info({ port: PORT }, 'Product service listening'));
  }
}

start();
export default app;
