import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

function resolveDatabaseUrl(url: string): string {
  if (url.includes('db.acppgssxziqbbwyhmjrm.supabase.co')) {
    return url.replace('db.acppgssxziqbbwyhmjrm.supabase.co', '[2406:da12:1f1:f800:8c2e:3916:9f03:55b9]');
  }
  return url;
}

const globalForPrisma = globalThis as unknown as { __mediflowPrisma?: PrismaClient };

/**
 * A single Prisma client per process. Importing this module from routes,
 * services or agents never creates a cycle (index.ts only wires the app).
 */
export const prisma: PrismaClient =
  globalForPrisma.__mediflowPrisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(env.DATABASE_URL),
      },
    },
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.__mediflowPrisma = prisma;
}
