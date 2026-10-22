// Trigger deployment - order-service
import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import orderRoutes from './routes/order.routes.js';
import {
  createCheckoutOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  adminListOrders,
  adminUpdateOrderStatus,
  adminGetDashboardMetrics,
  confirmOrderPayment,
} from './controllers/order.controller.js';
import { attachUser, requireAuth, requireRole } from './middleware/auth.middleware.js';

const log = createLogger('order-service');
const app: Express = express();
const PORT = process.env.ORDER_SERVICE_PORT ?? 4006;

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
    message: 'Order service running successfully',
    service: 'order-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'order-service', timestamp: new Date().toISOString() });
});

// Mounted paths
app.use('/api/v1', orderRoutes);

// Direct mapping for gateway forwarded subpaths
app.use(attachUser);
app.post('/api/v1/checkout', createCheckoutOrder);

app.get('/api/v1/orders', requireAuth, getMyOrders);
app.get('/api/v1/orders/:id', getOrderById);
app.post('/api/v1/orders/:id/cancel', requireAuth, cancelOrder);
app.patch('/api/v1/orders/:id/payment-confirmation', confirmOrderPayment);

app.get('/api/v1/admin/orders', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminListOrders);
app.get('/api/v1/admin/orders/:id', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), getOrderById);
app.patch('/api/v1/admin/orders/:id/status', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminUpdateOrderStatus);
app.get('/api/v1/admin/dashboard', requireAuth, requireRole('order_manager', 'finance_manager', 'admin', 'super_admin'), adminGetDashboardMetrics);

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  log.error({ err, path: req.url }, 'Unhandled error in order service');
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
    process.env.ORDER_DB_NAME ?? 'ornate_orders',
  );
  app.listen(PORT, () => {
    log.info({ port: PORT }, 'Order service listening');
  });
}

start().catch((err) => {
  log.error({ err }, 'Failed to start order service');
  process.exit(1);
});

export default app;
