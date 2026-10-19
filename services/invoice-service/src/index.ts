// Trigger deployment - invoice-service
import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import invoiceRoutes from './routes/invoice.routes.js';
import {
  generateInvoice,
  getInvoiceByOrderId,
  getInvoiceById,
  renderInvoiceHtml,
  adminListInvoices,
} from './controllers/invoice.controller.js';
import { attachUser, requireAuth, requireRole } from './middleware/auth.middleware.js';

const log = createLogger('invoice-service');
const app: Express = express();
const PORT = process.env.INVOICE_SERVICE_PORT ?? 4008;

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
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

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'invoice-service', timestamp: new Date().toISOString() });
});

// Mounted paths
app.use('/api/v1', invoiceRoutes);

// Direct mapping for gateway forwarded subpaths
app.use(attachUser);
app.post('/api/v1/invoices/generate', generateInvoice);
app.get('/api/v1/invoices/order/:orderId', getInvoiceByOrderId);
app.get('/api/v1/invoices/:id/html', renderInvoiceHtml);
app.get('/api/v1/invoices/:id', getInvoiceById);
app.get('/api/v1/admin/invoices', requireAuth, requireRole('finance_manager', 'admin', 'super_admin'), adminListInvoices);

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  log.error({ err, path: req.url }, 'Unhandled error in invoice service');
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
    process.env.INVOICE_DB_NAME ?? 'ornate_invoices',
  );
  app.listen(PORT, () => {
    log.info({ port: PORT }, 'Invoice service listening');
  });
}

start().catch((err) => {
  log.error({ err }, 'Failed to start invoice service');
  process.exit(1);
});

export default app;
