// Trigger deployment - api-gateway
import 'dotenv/config';
import express, { Express } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { createLogger } from '@ornate/logger';

const log = createLogger('api-gateway');

const app: Express = express();
const PORT = process.env.API_GATEWAY_PORT ?? 4000;

// ---- Security middleware ----
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

app.use(
  cors({
    origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);

app.use(cookieParser());

const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
});
app.use(globalLimiter);

// ---- Health ----
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// ---- Service routing table ----
const serviceRoutes: Array<{ path: string; target: string }> = [
  { path: '/api/v1/auth', target: process.env.AUTH_SERVICE_URL ?? 'http://localhost:4001' },
  { path: '/api/v1/users', target: process.env.USER_SERVICE_URL ?? 'http://localhost:4002' },
  { path: '/api/v1/addresses', target: process.env.USER_SERVICE_URL ?? 'http://localhost:4002' },
  { path: '/api/v1/wishlist', target: process.env.USER_SERVICE_URL ?? 'http://localhost:4002' },
  { path: '/api/v1/products', target: process.env.PRODUCT_SERVICE_URL ?? 'http://localhost:4003' },
  { path: '/api/v1/categories', target: process.env.PRODUCT_SERVICE_URL ?? 'http://localhost:4003' },
  { path: '/api/v1/search', target: process.env.SEARCH_SERVICE_URL ?? 'http://localhost:4004' },
  { path: '/api/v1/cart', target: process.env.CART_SERVICE_URL ?? 'http://localhost:4005' },
  { path: '/api/v1/checkout', target: process.env.ORDER_SERVICE_URL ?? 'http://localhost:4006' },
  { path: '/api/v1/orders', target: process.env.ORDER_SERVICE_URL ?? 'http://localhost:4006' },
  { path: '/api/v1/payments', target: process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:4007' },
  { path: '/api/v1/invoices', target: process.env.INVOICE_SERVICE_URL ?? 'http://localhost:4008' },
  { path: '/api/v1/inventory', target: process.env.INVENTORY_SERVICE_URL ?? 'http://localhost:4009' },
  // Admin routes — proxied to their respective services
  { path: '/api/v1/admin/products', target: process.env.PRODUCT_SERVICE_URL ?? 'http://localhost:4003' },
  { path: '/api/v1/admin/categories', target: process.env.PRODUCT_SERVICE_URL ?? 'http://localhost:4003' },
  { path: '/api/v1/admin/search', target: process.env.SEARCH_SERVICE_URL ?? 'http://localhost:4004' },
  { path: '/api/v1/admin/inventory', target: process.env.INVENTORY_SERVICE_URL ?? 'http://localhost:4009' },
  { path: '/api/v1/admin/orders', target: process.env.ORDER_SERVICE_URL ?? 'http://localhost:4006' },
  { path: '/api/v1/admin/payments', target: process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:4007' },
  { path: '/api/v1/admin/invoices', target: process.env.INVOICE_SERVICE_URL ?? 'http://localhost:4008' },
  { path: '/api/v1/admin/customers', target: process.env.USER_SERVICE_URL ?? 'http://localhost:4002' },
  { path: '/api/v1/admin/users', target: process.env.AUTH_SERVICE_URL ?? 'http://localhost:4001' },
  { path: '/api/v1/admin/dashboard', target: process.env.ORDER_SERVICE_URL ?? 'http://localhost:4006' },
  { path: '/api/v1/admin/audit-logs', target: process.env.AUTH_SERVICE_URL ?? 'http://localhost:4001' },
  { path: '/api/v1/admin/coupons', target: process.env.CART_SERVICE_URL ?? 'http://localhost:4005' },
];

// Sort routes so more specific paths match first if needed
const sortedRoutes = [...serviceRoutes].sort((a, b) => b.path.length - a.path.length);

// Mount each proxy with pathFilter so Express doesn't strip the route prefix
sortedRoutes.forEach(({ path, target }) => {
  app.use(
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathFilter: (pathname) => pathname === path || pathname.startsWith(path + '/') || pathname.startsWith(path + '?'),
      on: {
        error: (err, req, res) => {
          log.error({ err, path: req.url, target }, 'Proxy error');
          if ('headersSent' in res && !res.headersSent) {
            (res as express.Response).status(502).json({
              success: false,
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'The requested service is temporarily unavailable.',
              },
            });
          }
        },
      },
    }),
  );
});

// ---- 404 fallback ----
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found.' },
  });
});

app.listen(PORT, () => {
  log.info({ port: PORT }, `API Gateway listening`);
});

export default app;
