// Trigger deployment - payment-service (consolidated with invoice-service)
import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import paymentRoutes from './routes/payment.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import {
  createPaymentIntent,
  verifyPayment,
  adminListPayments,
} from './controllers/payment.controller.js';
import {
  generateInvoice,
  getInvoiceByOrderId,
  getInvoiceById,
  renderInvoiceHtml,
  adminListInvoices,
} from './controllers/invoice.controller.js';
import { attachUser, requireAuth, requireRole } from './middleware/auth.middleware.js';

const log = createLogger('payment-service');
const app: Express = express();
const PORT = process.env.PAYMENT_SERVICE_PORT ?? 4007;

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
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
    message: 'Payment & Invoice service running successfully',
    service: 'payment-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'payment-service', timestamp: new Date().toISOString() });
});

// Mounted paths
app.use('/api/v1', paymentRoutes);
app.use('/api/v1', invoiceRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/invoices', invoiceRoutes);

// Direct mapping for gateway forwarded subpaths
app.use(attachUser);
app.post('/api/v1/payments/create-intent', createPaymentIntent);
app.post('/api/v1/payments/intent', createPaymentIntent);
app.post('/api/v1/payments/verify', verifyPayment);
app.get('/api/v1/admin/payments', requireAuth, requireRole('finance_manager', 'admin', 'super_admin'), adminListPayments);

// Invoices direct mapping
app.post('/api/v1/invoices/generate', generateInvoice);
app.get('/api/v1/invoices/order/:orderId', getInvoiceByOrderId);
app.get('/api/v1/invoices/:id/html', renderInvoiceHtml);
app.get('/api/v1/invoices/:id', getInvoiceById);
app.get('/api/v1/admin/invoices', requireAuth, requireRole('finance_manager', 'admin', 'super_admin'), adminListInvoices);

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  log.error({ err, path: req.url }, 'Unhandled error in payment service');
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
      process.env.PAYMENT_DB_NAME ?? 'ornate_payments',
      { exitOnError: false, maxRetries: 2, serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 },
    );
  } catch (err) {
    log.error({ err }, 'MongoDB connection warning - will retry on demand');
  }

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
      log.info({ port: PORT }, 'Payment service listening');
    });
  }
}

start();

export default app;
