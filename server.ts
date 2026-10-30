import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { createServer } from 'http';

import { db } from './src/config/db';
import { requestIdMiddleware } from './src/middleware/requestId';
import { logger } from './src/utils/logger';
import Handler from './src/common/handler';
import { RES_MESSAGE, RES_STATUS, STATUS_CODE } from './src/common/statusMessageCode';

// Route imports
import helloRoute from './src/app/hello/router';
import authRouter from './src/app/auth/router';
import productsRouter from './src/app/products/router';
import customersRouter from './src/app/customers/router';
import salesRouter from './src/app/sales/router';
import creditsRouter from './src/app/credits/router';
import partialPaymentsRouter from './src/app/partialPayments/router';
import reportsRouter from './src/app/reports/router';
import dashboardRouter from './src/app/dashboard/router';
import settingsRouter from './src/app/settings/router';
import uploadsRouter from './src/app/uploads/router';
import categoriesRouter from './src/app/categories/router';
import sizesRouter from './src/app/sizes/router';

const app = express();
app.disable('x-powered-by');
app.use(cookieParser());

const port = process.env.SERVER_PORT || 3200;
const httpServer = createServer(app);

// Database connection
(async () => {
  try {
    await db.authenticate();
    logger.info('PostgreSQL database connected successfully.');

    await db.sync({ alter: true });
    logger.info('Tables synced successfully.');
  } catch (err) {
    logger.error('Database connection or sync error:', err);
  }
})();

// CORS
const allowedOrigins: string[] = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  credentials: true,
  exposedHeaders: ['access_token', 'x-request-id'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cache control
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.set('etag', false);

// Request ID middleware
app.use(requestIdMiddleware);

// HTTP request logging
app.use(
  morgan(':method :url :status :response-time ms', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  })
);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ message: 'Tulshi Fashion API is running!', status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/hello', helloRoute);
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/sales', salesRouter);
app.use('/api/credits', creditsRouter);
app.use('/api/partial-payments', partialPaymentsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/sizes', sizesRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC404, RES_MESSAGE.EM404));
});

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  (req as any).log?.error('Unhandled error', { error: err.message, stack: err.stack });
  res
    .status(STATUS_CODE.EC500)
    .json(Handler.Error(RES_STATUS.E2, STATUS_CODE.EC500, RES_MESSAGE.EM500));
});

httpServer.listen(port, () => {
  logger.info(`Tulshi Fashion Backend running at http://localhost:${port}`);
  logger.info(`Environment: ${process.env.SERVER_MODE || 'DEV'}`);
});
