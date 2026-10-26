import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../lib/api';
import { cn, formatDate, relativeTime } from '../lib/format';
import { Alert } from './ui/Alert';
import { EmptyState, LoadingBlock } from './ui/Layout';

const STATUS_CLASS: Record<string, string> = {
  COMPLETED: 'tag-pine',
  PROCESSING: 'tag-sky',
  FAILED: 'tag-crimson',
};

export function AgentActivityLog({
  patientId,
  limit = 6,
}: {
  patientId?: string | null;
  limit?: number;
}) {
  const query = useQuery({
    queryKey: ['agent-activity', patientId, limit],
    queryFn: () =>
      patientId
        ? api.activity.list(patientId, limit, 0)
        : Promise.resolve({ activities: [], total: 0 }),
    enabled: Boolean(patientId),
  });

  if (!patientId) {
    return (
      <EmptyState
        title="No patient selected"
        description="Select a patient to view their recorded agent activity."
      />
    );
  }

  if (query.isLoading) return <LoadingBlock label="Loading agent activity" />;
  if (query.isError) {
    return (
      <Alert tone="danger" title="Agent activity unavailable">
        {errorMessage(query.error)}
      </Alert>
    );
  }

  const activities = query.data?.activities ?? [];
  if (activities.length === 0) {
    return (
      <EmptyState
        title="No agent runs yet"
        description="Upload a document or use the navigator. Each run will be recorded here with a plain-language result."
      />
    );
  }

  return (
    <ol className="divide-y divide-rule border-y border-rule">
      {activities.map((activity) => (
        <li key={activity.id} className="py-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint">
              {activity.label || activity.agentName}
            </span>
            <span className={cn(STATUS_CLASS[activity.status] ?? 'tag-neutral', 'ml-auto')}>
              {activity.status?.toLowerCase() ?? 'unknown'}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">
            {activity.briefOutput || activity.description || 'Completed.'}
          </p>
          <p className="mt-1 font-mono text-2xs uppercase tracking-[0.08em] text-ink-faint">
            {formatDate(activity.createdAt)} · {relativeTime(activity.createdAt)}
            {activity.duration !== null && activity.duration !== undefined
              ? ` · ${Math.round(activity.duration)} ms`
              : ''}
          </p>
        </li>
      ))}
    </ol>
  );
}
