import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: '../api/.env' });
dotenv.config();

import authRoutes from './routes/auth.js';
import medicalRecordsRoutes from './routes/medicalRecords.js';
import agentsRoutes from './routes/agents.js';
import agentActivityRoutes from './routes/agentActivity.js';
import appointmentsRoutes from './routes/appointments.js';
import remindersRoutes from './routes/reminders.js';
import facilitiesRoutes from './routes/facilities.js';
import providersRoutes from './routes/providers.js';

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'MediFlow API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/medical-records', medicalRecordsRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/agent-activity', agentActivityRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/facilities', facilitiesRoutes);
app.use('/api/providers', providersRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'Endpoint not found' });
});

async function main() {
  try {
    await prisma.$connect();
    console.log('Database connected');

    app.listen(PORT, () => {
      console.log(`MediFlow API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
