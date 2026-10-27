// Trigger deployment - api-gateway v3 (consolidated 5-service architecture)
import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { createLogger } from './logger.js';

const log = createLogger('api-gateway');

const app: Express = express();
const PORT = process.env.API_GATEWAY_PORT ?? 4000;

const isLocal = process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';

// Consolidated target resolution with fallbacks
const authTarget =
  process.env.AUTH_SERVICE_URL ??
  process.env.USER_SERVICE_URL ??
  (isLocal ? 'http://localhost:4001' : 'https://e-comm-auth-alpha.vercel.app');

const productTarget =
  process.env.PRODUCT_SERVICE_URL ??
  process.env.CATALOG_SERVICE_URL ??
  process.env.INVENTORY_SERVICE_URL ??
  process.env.SEARCH_SERVICE_URL ??
  (isLocal ? 'http://localhost:4003' : 'https://e-comm-product-two.vercel.app');

const orderTarget =
  process.env.ORDER_SERVICE_URL ??
  process.env.CART_SERVICE_URL ??
  (isLocal ? 'http://localhost:4006' : 'https://e-comm-order.vercel.app');

const paymentTarget =
  process.env.PAYMENT_SERVICE_URL ??
  process.env.INVOICE_SERVICE_URL ??
  (isLocal ? 'http://localhost:4007' : 'https://e-comm-payment.vercel.app');

const notificationTarget =
  process.env.NOTIFICATION_SERVICE_URL ??
  (isLocal ? 'http://localhost:4010' : 'https://e-comm-notification.vercel.app');

// ---- Security middleware ----
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

const staticAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:4000',
  'https://e-shophy-admin.vercel.app',
  'https://e-shophy-ui.vercel.app',
  'https://e-comm-three-eta.vercel.app',
  'https://e-comm-admin-gules.vercel.app',
];

const envAllowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true; // Server-to-server or same-origin
  if (staticAllowedOrigins.includes(origin) || envAllowedOrigins.includes(origin)) {
    return true;
  }
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith('.vercel.app')) return true;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  } catch {
    // Malformed origin
  }
  return false;
};

const corsOptions: cors.CorsOptions = {
  origin: (requestOrigin, callback) => {
    if (isOriginAllowed(requestOrigin)) {
      callback(null, true);
    } else {
      log.warn({ requestOrigin }, 'CORS rejected origin');
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cookie',
    'X-CSRF-Token',
    'x-session-id',
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200, // some legacy browsers choke on 204
};

const corsMiddleware = cors(corsOptions);
app.use(corsMiddleware);

// Explicit OPTIONS pre-flight for all routes using exact same CORS config
app.options('*', corsMiddleware);

app.use(cookieParser());

const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
});
app.use(globalLimiter);

// ---- Health & Root ----
app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'API Gateway running successfully (5-service architecture)',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// ---- Multi-service Health Check Aggregator (5 Consolidated Services) ----
const systemHealthHandler = async (_req: Request, res: Response) => {
  const services = [
    { name: 'Auth & User Service', key: 'auth', path: '/api/v1/auth', target: authTarget },
    { name: 'Product & Catalog Service', key: 'product', path: '/api/v1/products', target: productTarget },
    { name: 'Order & Cart Service', key: 'order', path: '/api/v1/orders', target: orderTarget },
    { name: 'Payment & Invoice Service', key: 'payment', path: '/api/v1/payments', target: paymentTarget },
    { name: 'Notification Service', key: 'notification', path: '/api/v1/notifications', target: notificationTarget },
  ];

  const results = await Promise.allSettled(
    services.map(async (svc) => {
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const healthUrl = `${svc.target.replace(/\/+$/, '')}/health`;
        const response = await fetch(healthUrl, { signal: controller.signal });
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        if (response.ok) {
          const body = await response.json().catch(() => null);
          return {
            ...svc,
            status: 'HEALTHY',
            httpStatus: response.status,
            latency,
            data: body,
          };
        } else {
          return {
            ...svc,
            status: 'DEGRADED',
            httpStatus: response.status,
            latency,
            error: `HTTP ${response.status} ${response.statusText}`,
          };
        }
      } catch (err: any) {
        return {
          ...svc,
          status: 'OFFLINE',
          httpStatus: 0,
          latency: Date.now() - startTime,
          error: err.name === 'AbortError' ? 'Timeout (6s)' : (err.message || 'Connection failed'),
        };
      }
    }),
  );

  const serviceResults = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          ...services[i],
          status: 'OFFLINE',
          httpStatus: 0,
          latency: 0,
          error: String((r as PromiseRejectedResult).reason),
        },
  );

  const healthyCount = serviceResults.filter((s) => s.status === 'HEALTHY').length;

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    gateway: {
      name: 'API Gateway',
      key: 'gateway',
      path: '/',
      target: process.env.API_GATEWAY_URL ?? `http://localhost:${PORT}`,
      status: 'HEALTHY',
      httpStatus: 200,
      latency: 0,
      data: { status: 'ok', service: 'api-gateway' },
    },
    summary: {
      total: services.length + 1,
      healthy: healthyCount + 1,
      degraded: serviceResults.filter((s) => s.status === 'DEGRADED').length,
      offline: serviceResults.filter((s) => s.status === 'OFFLINE').length,
    },
    services: serviceResults,
  });
};

app.get('/api/v1/system/health', systemHealthHandler);
app.get('/health/all', systemHealthHandler);

// ---- Service routing table (Preserving 100% of API Gateway routes) ----
const serviceRoutes: Array<{ path: string; target: string }> = [
  // 1. Auth & Users Service
  { path: '/api/v1/auth', target: authTarget },
  { path: '/api/v1/users', target: authTarget },
  { path: '/api/v1/addresses', target: authTarget },
  { path: '/api/v1/wishlist', target: authTarget },
  { path: '/api/v1/admin/customers', target: authTarget },
  { path: '/api/v1/admin/users', target: authTarget },
  { path: '/api/v1/admin/audit-logs', target: authTarget },

  // 2. Product, Catalog, Search & Inventory Service
  { path: '/api/v1/products', target: productTarget },
  { path: '/api/v1/categories', target: productTarget },
  { path: '/api/v1/search', target: productTarget },
  { path: '/api/v1/inventory', target: productTarget },
  { path: '/api/v1/admin/products', target: productTarget },
  { path: '/api/v1/admin/categories', target: productTarget },
  { path: '/api/v1/admin/search', target: productTarget },
  { path: '/api/v1/admin/inventory', target: productTarget },

  // 3. Order, Cart & Coupon Service
  { path: '/api/v1/cart', target: orderTarget },
  { path: '/api/v1/checkout', target: orderTarget },
  { path: '/api/v1/orders', target: orderTarget },
  { path: '/api/v1/admin/orders', target: orderTarget },
  { path: '/api/v1/admin/dashboard', target: orderTarget },
  { path: '/api/v1/admin/coupons', target: orderTarget },

  // 4. Payment & Invoice Service
  { path: '/api/v1/payments', target: paymentTarget },
  { path: '/api/v1/invoices', target: paymentTarget },
  { path: '/api/v1/admin/payments', target: paymentTarget },
  { path: '/api/v1/admin/invoices', target: paymentTarget },

  // 5. Notification Service
  { path: '/api/v1/notifications', target: notificationTarget },
  { path: '/api/v1/admin/notifications', target: notificationTarget },
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
        proxyRes: (proxyRes, req) => {
          const origin = (req as Request).headers?.origin;
          if (origin && isOriginAllowed(origin)) {
            proxyRes.headers['access-control-allow-origin'] = origin;
            proxyRes.headers['access-control-allow-credentials'] = 'true';
          }
        },
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

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    log.info({ port: PORT }, `API Gateway listening`);
  });
}

export default app;
