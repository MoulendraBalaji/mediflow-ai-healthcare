import { useMutation } from '@tanstack/react-query';
import { api, errorMessage } from '../lib/api';
import { cn, riskClass } from '../lib/format';
import type { PatientInsight } from '../lib/types';
import { Alert, ModeNote } from './ui/Alert';
import { Button } from './ui/Button';
import { LoadingBlock } from './ui/Layout';

export function InsightPanel({ patientId }: { patientId: string }) {
  const mutation = useMutation<PatientInsight, unknown, void>({
    mutationFn: () => api.agents.insight(patientId),
  });

  const insight = mutation.data;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint">Recorded-care insight</p>
          <p className="mt-1 text-sm text-ink-soft">
            Built from counts on file. It does not measure doses taken.
          </p>
        </div>
        <Button
          variant={insight ? 'quiet' : 'primary'}
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
        >
          {insight ? 'Refresh insight' : 'Generate insight'}
        </Button>
      </div>

      {mutation.isError ? (
        <Alert tone="danger" title="Insight unavailable" className="mt-4">
          {errorMessage(mutation.error)}
        </Alert>
      ) : null}

      {mutation.isPending ? (
        <div className="mt-6">
          <LoadingBlock label="Generating insight" />
        </div>
      ) : null}

      {insight ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className={riskClass(insight.riskLevel)}>{insight.riskLevel} risk flag</span>
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
              Care-engagement score {insight.careEngagementScore}/100
            </span>
          </div>
          <p className="prose-editorial mt-4 text-base">{insight.summary}</p>

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-rule pt-4 sm:grid-cols-3">
            {[
              ['Active medicines', insight.metrics.activeMedications],
              ['Completed visits', insight.metrics.completedVisits],
              ['Upcoming visits', insight.metrics.upcomingVisits],
              ['Overdue / missed', insight.metrics.missedVisits],
              ['Documents', insight.metrics.records],
              ['Care gaps', insight.metrics.careGaps],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="data-key">{label}</dt>
                <dd className="mt-0.5 font-display text-xl text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 border-t border-rule pt-4">
            <p className="eyebrow">Suggested next steps</p>
            <ul className="mt-2 space-y-2">
              {insight.recommendations.map((recommendation) => (
                <li key={recommendation} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                  <span className={cn('mt-2 h-1.5 w-1.5 shrink-0', 'bg-pine')} aria-hidden="true" />
                  {recommendation}
                </li>
              ))}
            </ul>
          </div>

          <ModeNote mode={insight.mode} className="mt-4" />
        </div>
      ) : null}

      {!insight && !mutation.isPending && !mutation.isError ? (
        <p className="mt-5 border-t border-rule pt-4 text-sm leading-relaxed text-ink-faint">
          Nothing is generated automatically. Choose “Generate insight” to summarise the record that is
          already saved.
        </p>
      ) : null}
    </div>
  );
}
