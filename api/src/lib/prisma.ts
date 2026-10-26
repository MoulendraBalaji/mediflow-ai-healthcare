import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const globalForPrisma = globalThis as unknown as { __mediflowPrisma?: PrismaClient };

/**
 * A single Prisma client per process. Importing this module from routes,
 * services or agents never creates a cycle (index.ts only wires the app).
 */
export const prisma: PrismaClient =
  globalForPrisma.__mediflowPrisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.__mediflowPrisma = prisma;
}
