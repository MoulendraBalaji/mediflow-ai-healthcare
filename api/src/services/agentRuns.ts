import type { AgentName, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface AgentRunResult<T> {
  output: T;
  duration: number;
  activityId: string;
}

const MAX_ERROR_LENGTH = 400;

/**
 * Wrap an agent call in a durable AgentActivity row.
 *
 * PROCESSING is written first so the UI can show work in flight; the row is
 * then marked COMPLETED or FAILED. The raw error text is trimmed and stored in a
 * private column (never returned verbatim to patients).
 */
export async function withAgentRun<T>(
  patientId: string,
  agentName: AgentName,
  input: Record<string, unknown>,
  run: () => Promise<T>
): Promise<AgentRunResult<T>> {
  const activity = await prisma.agentActivity.create({
    data: {
      patientId,
      agentName,
      status: 'PROCESSING',
      input: input as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  const startedAt = Date.now();

  try {
    const output = await run();
    const duration = Date.now() - startedAt;

    await prisma.agentActivity.update({
      where: { id: activity.id },
      data: {
        status: 'COMPLETED',
        output: output as Prisma.InputJsonValue,
        duration,
      },
    });

    return { output, duration, activityId: activity.id };
  } catch (error) {
    const duration = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : 'Agent run failed';

    await prisma.agentActivity
      .update({
        where: { id: activity.id },
        data: {
          status: 'FAILED',
          duration,
          error: message.slice(0, MAX_ERROR_LENGTH),
        },
      })
      .catch((updateError: unknown) => {
        logger.warn({ err: updateError, activityId: activity.id }, 'failed to close agent activity');
      });

    throw error;
  }
}
