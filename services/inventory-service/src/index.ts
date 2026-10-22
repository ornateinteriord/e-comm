// Trigger deployment - inventory-service
import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import inventoryRoutes from './routes/inventory.routes.js';
import {
  checkStock,
  reserveStock,
  deductStock,
  adminListInventory,
  adminAdjustStock,
  adminListMovements,
} from './controllers/inventory.controller.js';
import { attachUser, requireAuth, requireRole } from './middleware/auth.middleware.js';

const log = createLogger('inventory-service');
const app: Express = express();
const PORT = process.env.INVENTORY_SERVICE_PORT ?? 4009;

app.use(helmet());
app.use(
  cors({
    origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:4000,http://localhost:5173').split(',').map((o) => o.trim()),
    credentials: true,
  }),
);
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
    message: 'Inventory service running successfully',
    service: 'inventory-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'inventory-service', timestamp: new Date().toISOString() });
});

// Mounted paths
app.use('/api/v1', inventoryRoutes);

// Direct mapping for gateway forwarded subpaths
app.use(attachUser);
app.post('/api/v1/inventory/check', checkStock);
app.post('/api/v1/inventory/reserve', reserveStock);
app.post('/api/v1/inventory/deduct', deductStock);

app.get('/api/v1/admin/inventory', requireAuth, requireRole('inventory_manager', 'admin', 'super_admin'), adminListInventory);
app.post('/api/v1/admin/inventory/adjust', requireAuth, requireRole('inventory_manager', 'admin', 'super_admin'), adminAdjustStock);
app.get('/api/v1/admin/inventory/movements', requireAuth, requireRole('inventory_manager', 'admin', 'super_admin'), adminListMovements);

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  log.error({ err, path: req.url }, 'Unhandled error in inventory service');
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
    process.env.INVENTORY_DB_NAME ?? 'ornate_inventory',
  );
  app.listen(PORT, () => {
    log.info({ port: PORT }, 'Inventory service listening');
  });
}

start().catch((err) => {
  log.error({ err }, 'Failed to start inventory service');
  process.exit(1);
});

export default app;
