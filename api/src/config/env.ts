/**
 * Environment loading and validation.
 *
 * IMPORTANT: this module must be imported before any other module that reads
 * configuration. It loads .env synchronously (searching upwards from the cwd)
 * so that values are present when the rest of the app is evaluated.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

function loadDotenv(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
    path.resolve(process.cwd(), '..', '..', '.env'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      dotenv.config({ path: file });
      return;
    }
  }
  // No .env file: rely on real environment variables (Docker, CI, etc.).
}

loadDotenv();

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
  GROQ_API_KEY: z.string().optional(),
  GROQ_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  GROQ_FAST_MODEL: z.string().default('llama-3.1-8b-instant'),
  GROQ_STRONG_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GROQ_VISION_MODEL: z.string().default('meta-llama/llama-4-scout-17b-16e-instruct'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(12000),
  DEMO_MODE: booleanish.default(false),
  DEMO_PASSWORD: z.string().optional(),
  EMERGENCY_NUMBER: z.string().default('112'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    // eslint-disable-next-line no-console
    console.error(`FATAL: invalid environment configuration:\n${lines.join('\n')}`);
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
}

export const env: Env = parseEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isDemo = env.DEMO_MODE;
