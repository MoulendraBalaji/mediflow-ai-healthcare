import Head from 'next/head';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '../components/AppShell';
import { Alert, ClinicalDisclaimer } from '../components/ui/Alert';
import { ButtonLink } from '../components/ui/Button';
import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  SectionHeading,
  Skeleton,
  Stat,
} from '../components/ui/Layout';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDate, percent, recordTypeLabel } from '../lib/format';

const COMPLIANCE_ROWS = [
  { key: 'compliant', label: 'No missed visits', bar: 'bg-pine' },
  { key: 'partiallyCompliant', label: 'Some missed visits', bar: 'bg-ochre' },
  { key: 'nonCompliant', label: 'Frequent missed visits', bar: 'bg-crimson' },
  { key: 'noHistory', label: 'No visit history', bar: 'bg-rule-strong' },
] as const;

export default function AdminPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const analyticsQuery = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => api.agents.analytics(),
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const statusQuery = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.agents.status(),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  if (!isAdmin) {
    return (
      <AppShell>
        <Head>
          <title>Analytics · MediFlow</title>
        </Head>
        <PageHeader
          eyebrow="Analytics"
          title="Administrator access only."
          description="Hospital-wide aggregates are available to administrator accounts. Patient records stay behind their own access checks."
        />
        <div className="mt-8">
          <EmptyState
            title="This screen is not for your role"
            description="Clinicians can open the patient panel; patients can open their dashboard."
            action={
              <ButtonLink href={user?.role === 'DOCTOR' ? '/doctor-portal' : '/dashboard'}>
                Go to your workspace
              </ButtonLink>
            }
          />
        </div>
      </AppShell>
    );
  }

  const analytics = analyticsQuery.data;
  const status = statusQuery.data;
  const complianceTotal = analytics
    ? analytics.complianceBreakdown.compliant +
      analytics.complianceBreakdown.partiallyCompliant +
      analytics.complianceBreakdown.nonCompliant +
      analytics.complianceBreakdown.noHistory
    : 0;
  const maxBottleneck = analytics
    ? Math.max(1, ...analytics.appointmentBottlenecks.map((row) => row.pendingCount))
    : 1;

  return (
    <AppShell>
      <Head>
        <title>Analytics · MediFlow</title>
      </Head>

      <PageHeader
        eyebrow="Analytics"
        title="The shape of recorded care."
        description="Aggregates only: counts of patients, visits, documents and recorded no-shows. No patient-identifying text is sent to a model, and nothing here is a clinical judgment."
        meta={
          <>
            {analytics?.cached ? <span className="tag-neutral">served from 60-second cache</span> : null}
            {analytics ? (
              <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                Generated {formatDate(analytics.generatedAt)}
              </span>
            ) : null}
          </>
        }
      />

      {analyticsQuery.isError ? (
        <Alert tone="danger" title="Could not load analytics" className="mt-6">
          {errorMessage(analyticsQuery.error)}
        </Alert>
      ) : null}

      <section aria-label="Operational summary" className="mt-8">
        {analyticsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : analytics ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat value={analytics.totalPatients} label="Patients" accent="pine" note="In the database" />
            <Stat value={analytics.totalAppointments} label="Appointments" note="All recorded statuses" />
            <Stat
              value={analytics.upcomingAppointmentCount}
              label="Upcoming"
              note="Scheduled from today onward"
            />
            <Stat
              value={`${analytics.missedFollowUpRate}%`}
              label="No-show / cancelled"
              accent={analytics.missedFollowUpRate > 20 ? 'clay' : 'ink'}
              note={`Average ${analytics.averageAppointmentsPerPatient} visits per patient`}
            />
          </div>
        ) : null}
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
        <div className="space-y-12">
          <section aria-labelledby="bottlenecks-heading">
            <SectionHeading
              number="01"
              id="bottlenecks-heading"
              title="Where visits are waiting"
              description="The five clinicians with the most future scheduled visits. This is a workload signal, not a performance rating."
            />
            <div className="mt-5">
              {analyticsQuery.isLoading ? (
                <LoadingBlock label="Loading workload" />
              ) : (analytics?.appointmentBottlenecks.length ?? 0) === 0 ? (
                <EmptyState
                  title="No scheduled visits"
                  description="There are no future scheduled appointments to show."
                />
              ) : (
                <ol className="divide-y divide-rule border-y border-rule">
                  {analytics?.appointmentBottlenecks.map((row, index) => (
                    <li key={row.providerId} className="py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-3">
                          <span className="font-mono text-2xs text-ink-faint">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-ink">{row.providerName}</p>
                            <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                              {row.specialty}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-sm text-ink">{row.pendingCount} scheduled</span>
                      </div>
                      <div className="mt-2 h-1 w-full bg-rule" role="presentation">
                        <div
                          className="h-1 bg-pine"
                          style={{ width: `${Math.max(6, percent(row.pendingCount, maxBottleneck))}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section aria-labelledby="records-heading">
            <SectionHeading
              number="02"
              id="records-heading"
              title="Recent documented care"
              description="The ten most recent saved documents, shown as records rather than inferred treatment courses."
            />
            <div className="mt-5">
              {analyticsQuery.isLoading ? (
                <LoadingBlock label="Loading records" />
              ) : (analytics?.treatmentTimelines.length ?? 0) === 0 ? (
                <EmptyState
                  title="No documents yet"
                  description="Once documents are uploaded and saved, the most recent ten appear here."
                />
              ) : (
                <div className="overflow-x-auto border-y border-rule">
                  <table className="w-full min-w-[40rem] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-rule">
                        {['Patient', 'Document', 'Type', 'Date', 'Days on file'].map((heading) => (
                          <th
                            key={heading}
                            scope="col"
                            className="py-2.5 pr-4 font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analytics?.treatmentTimelines.map((row) => (
                        <tr key={`${row.patientId}-${row.startDate}-${row.treatment}`} className="border-b border-rule align-top last:border-b-0">
                          <th scope="row" className="py-3 pr-4 text-sm font-semibold text-ink">
                            {row.patientName}
                          </th>
                          <td className="max-w-[18rem] py-3 pr-4 text-sm text-ink-soft">{row.treatment}</td>
                          <td className="py-3 pr-4 text-sm text-ink-soft">{recordTypeLabel(row.status)}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-ink-soft">
                            {formatDate(row.startDate)}
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs text-ink-soft">{row.durationDays}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <section className="border border-rule bg-surface p-5 sm:p-6" aria-labelledby="compliance-heading">
            <p className="eyebrow">Visit pattern</p>
            <h2 id="compliance-heading" className="mt-1 font-display text-2xl text-ink">
              Missed-visit share
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Grouped by the proportion of recorded visits that were cancelled or marked no-show. This
              describes the record, not whether a patient followed advice.
            </p>

            {analyticsQuery.isLoading ? (
              <div className="mt-5">
                <LoadingBlock label="Loading visit pattern" />
              </div>
            ) : analytics ? (
              <div className="mt-5">
                <div className="flex h-3 w-full overflow-hidden border border-rule" role="presentation">
                  {COMPLIANCE_ROWS.map((row) => {
                    const value = analytics.complianceBreakdown[row.key];
                    if (value === 0) return null;
                    return (
                      <div
                        key={row.key}
                        className={row.bar}
                        style={{ width: `${percent(value, complianceTotal)}%` }}
                      />
                    );
                  })}
                </div>

                <dl className="mt-4 divide-y divide-rule border-y border-rule">
                  {COMPLIANCE_ROWS.map((row) => {
                    const value = analytics.complianceBreakdown[row.key];
                    return (
                      <div key={row.key} className="flex items-center justify-between gap-3 py-2.5">
                        <dt className="flex items-center gap-2 text-sm text-ink-soft">
                          <span className={`h-2 w-2 shrink-0 ${row.bar}`} aria-hidden="true" />
                          {row.label}
                        </dt>
                        <dd className="font-mono text-sm text-ink">
                          {value}
                          <span className="ml-2 text-2xs text-ink-faint">
                            {percent(value, complianceTotal)}%
                          </span>
                        </dd>
                      </div>
                    );
                  })}
                </dl>

                <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                  {analytics.complianceBreakdown.noHistory} patient
                  {analytics.complianceBreakdown.noHistory === 1 ? ' has' : 's have'} no appointment
                  history, so no pattern can be stated.
                </p>
              </div>
            ) : null}
          </section>

          <section className="border border-rule bg-paper p-5 sm:p-6" aria-labelledby="ai-heading">
            <p className="eyebrow">AI layer</p>
            <h2 id="ai-heading" className="mt-1 font-display text-2xl text-ink">
              Current mode
            </h2>

            {statusQuery.isLoading ? (
              <div className="mt-4">
                <LoadingBlock label="Checking the AI layer" />
              </div>
            ) : statusQuery.isError ? (
              <Alert tone="warning" title="Could not read the AI status" className="mt-4">
                {errorMessage(statusQuery.error)}
              </Alert>
            ) : status ? (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  <span className={status.mode === 'ai' ? 'tag-pine' : 'tag-ochre'}>
                    {status.mode === 'ai' ? 'AI-assisted' : 'Rule-based'}
                  </span>
                  <span className={status.available ? 'tag-pine' : 'tag-neutral'}>
                    {status.available ? 'available' : 'not available'}
                  </span>
                  {status.model ? <span className="tag-neutral">{status.model}</span> : null}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                  {status.configured
                    ? 'A provider key is configured. Model output may assist wording, but deterministic rules still set urgency and recommendations.'
                    : 'No provider key is configured. Every agent runs on explicit rules and labels its output as rule-based.'}
                </p>
                {status.reason ? (
                  <p className="mt-2 text-xs leading-relaxed text-ink-faint">{status.reason}</p>
                ) : null}
                <p className="mt-3 font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                  Checked {formatDate(status.generatedAt)}
                </p>
              </div>
            ) : null}
          </section>

          <section className="border border-rule bg-surface p-5 sm:p-6">
            <p className="eyebrow">Directory</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Facility and clinician records live outside this analytics view. Open the directory to review
              coverage without exposing patient data.
            </p>
            <ButtonLink href="/facilities" variant="quiet" className="mt-4 w-full">
              Open facilities
            </ButtonLink>
            <button
              type="button"
              className="btn-link mt-4 text-sm"
              onClick={() => {
                void analyticsQuery.refetch();
                void statusQuery.refetch();
              }}
            >
              Refresh aggregates
            </button>
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">
              Aggregates are cached for 60 seconds. Refreshing sooner may show the same snapshot.
            </p>
          </section>

          <ClinicalDisclaimer />
        </aside>
      </div>
    </AppShell>
  );
}
