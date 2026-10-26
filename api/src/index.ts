import './config/env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env, isProduction } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import medicalRecordsRoutes from './routes/medicalRecords.js';
import agentsRoutes from './routes/agents.js';
import agentActivityRoutes from './routes/agentActivity.js';
import appointmentsRoutes from './routes/appointments.js';
import remindersRoutes from './routes/reminders.js';
import facilitiesRoutes from './routes/facilities.js';
import providersRoutes from './routes/providers.js';

export const app = express();

app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Security and observability
// ---------------------------------------------------------------------------

app.use(requestIdMiddleware);
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({ requestId: (req as express.Request).requestId }),
  })
);

app.use(
  helmet({
    // The API returns JSON only; no inline app shell needs a CSP.
    contentSecurityPolicy: false,
  })
);
app.use(compression());

if (env.CORS_ORIGINS.includes('*')) {
  throw new Error('CORS_ORIGINS must list explicit origins; wildcard credentials are not allowed');
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86_400,
  })
);

const skipLimits = () => env.NODE_ENV === 'test';

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipLimits,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' },
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipLimits,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Please wait and try again.' },
  },
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipLimits,
  message: {
    error: { code: 'RATE_LIMITED', message: 'The assistant is busy. Please wait a moment and try again.' },
  },
});

app.use(globalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/agents', aiLimiter);
app.use('/api/providers/translate', aiLimiter);
app.use('/api/providers/explain-prescription', aiLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---------------------------------------------------------------------------
// Health (liveness + database readiness)
// ---------------------------------------------------------------------------

async function health(_req: express.Request, res: express.Response): Promise<void> {
  let db: 'up' | 'down' = 'up';
  let dbLatencyMs: number | null = null;

  try {
    const started = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - started;
  } catch {
    db = 'down';
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(db === 'up' ? 200 : 503).json({
    status: db === 'up' ? 'ok' : 'degraded',
    service: 'mediflow-api',
    db,
    dbLatencyMs,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

app.get('/health', health);
app.get('/api/health', health);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use('/api/auth', authRoutes);
app.use('/api/medical-records', medicalRecordsRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/agent-activity', agentActivityRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/facilities', facilitiesRoutes);
app.use('/api/providers', providersRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Boot and shutdown
// ---------------------------------------------------------------------------

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('database connected');
  } catch (error) {
    logger.error({ err: error }, 'database is unreachable at boot; starting in degraded mode');
  }

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'MediFlow API listening');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (process.env.NODE_ENV !== 'test') {
  void start();
}

export default app;
