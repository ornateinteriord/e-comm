// Trigger deployment - order-service (consolidated with cart-service)
import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { connectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import orderRoutes from './routes/order.routes.js';
import cartRoutes from './routes/cart.routes.js';
import { Coupon } from './models/coupon.model.js';
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
import {
  adminListCoupons,
  adminCreateCoupon,
  adminUpdateCoupon,
  adminDeleteCoupon,
} from './controllers/cart.controller.js';
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
app.use(cookieParser());

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
    message: 'Order & Cart service running successfully',
    service: 'order-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'order-service', timestamp: new Date().toISOString() });
});

// Mounted paths
app.use('/api/v1', orderRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/cart', cartRoutes);

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

// Admin coupons direct routes
app.get('/api/v1/admin/coupons', requireAuth, requireRole('catalog_manager', 'admin', 'super_admin'), adminListCoupons);
app.post('/api/v1/admin/coupons', requireAuth, requireRole('catalog_manager', 'admin', 'super_admin'), adminCreateCoupon);
app.put('/api/v1/admin/coupons/:id', requireAuth, requireRole('catalog_manager', 'admin', 'super_admin'), adminUpdateCoupon);
app.delete('/api/v1/admin/coupons/:id', requireAuth, requireRole('admin', 'super_admin'), adminDeleteCoupon);

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

async function seedCoupons(): Promise<void> {
  try {
    const count = await Coupon.countDocuments();
    if (count === 0) {
      await Coupon.create([
        {
          code: 'WELCOME10',
          type: 'percentage',
          value: 10,
          maxDiscountAmount: 50000, // ₹500 cap
          minOrderValue: 50000,     // min ₹500
          validFrom: new Date(),
          validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
        {
          code: 'FLAT500',
          type: 'fixed',
          value: 50000,             // ₹500 off
          minOrderValue: 200000,    // min ₹2000
          validFrom: new Date(),
          validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
        {
          code: 'SUPER20',
          type: 'percentage',
          value: 20,
          maxDiscountAmount: 100000, // ₹1000 cap
          minOrderValue: 100000,     // min ₹1000
          validFrom: new Date(),
          validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      ]);
      log.info('Seeded default coupons: WELCOME10, FLAT500, SUPER20');
    }
  } catch (err) {
    log.error({ err }, 'Failed to seed default coupons');
  }
}

const DEFAULT_MONGODB_URI =
  'mongodb+srv://ornateinteriord:22k3ZVbQMZDpybDP@cluster0.plzr559.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function start(): Promise<void> {
  try {
    await connectDB(
      process.env.MONGODB_URI ?? DEFAULT_MONGODB_URI,
      process.env.ORDER_DB_NAME ?? 'ornate_orders',
      { exitOnError: false, maxRetries: 2, serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 },
    );
    await seedCoupons();
  } catch (err) {
    log.error({ err }, 'MongoDB connection warning - will retry on demand');
  }

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
      log.info({ port: PORT }, 'Order service listening');
    });
  }
}

start();

export default app;
