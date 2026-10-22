// Trigger deployment - product-service
import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import productRoutes from './routes/product.routes.js';

const log = createLogger('product-service');
const app: Express = express();
const PORT = process.env.PRODUCT_SERVICE_PORT ?? 4003;

app.use(helmet());
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:4000').split(',').map((o) => o.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use(limiter);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Product service running successfully',
    service: 'product-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok', service: 'product-service' }));
app.use(productRoutes);

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

async function start(): Promise<void> {
  await connectDB(
    process.env.MONGODB_URI ?? 'mongodb://localhost:27017',
    process.env.PRODUCT_DB_NAME ?? 'ornate_products',
  );
  app.listen(PORT, () => log.info({ port: PORT }, 'Product service listening'));
}

start().catch((err) => { log.error({ err }, 'Failed to start product service'); process.exit(1); });
export default app;
