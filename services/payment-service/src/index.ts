// Payment Service - Cashfree Production Enabled
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
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
import {
  createCashfreeOrder,
  verifyCashfreePayment,
  cashfreeWebhook,
} from './controllers/cashfree.controller.js';
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

const paymentCors = cors({
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

app.use(paymentCors);
app.options('*', paymentCors);
// Capture raw body for Cashfree webhook HMAC verification (must come before JSON parser)
app.use((req, _res, next) => {
  if (req.path === '/api/v1/webhooks/cashfree') {
    let rawData = Buffer.alloc(0);
    req.on('data', (chunk: Buffer) => { rawData = Buffer.concat([rawData, chunk]); });
    req.on('end', () => { (req as any).rawBody = rawData; next(); });
  } else {
    next();
  }
});
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

// Cashfree webhook — must be registered BEFORE attachUser to avoid body re-parsing
app.post('/api/v1/webhooks/cashfree', cashfreeWebhook);

// Direct mapping for gateway forwarded subpaths
app.use(attachUser);

// Cashfree payment routes (primary gateway)
app.post('/api/v1/payments/cashfree/create-order', createCashfreeOrder);
app.post('/api/v1/payments/cashfree/verify', verifyCashfreePayment);

// Legacy Razorpay routes (kept for compatibility)
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

async function start(): Promise<void> {
  try {
    await connectDB(
      process.env.MONGODB_URI || '',
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
