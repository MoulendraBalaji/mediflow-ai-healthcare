import Head from 'next/head';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '../components/AppShell';
import { AgentActivityLog } from '../components/AgentActivityLog';
import { InsightPanel } from '../components/InsightPanel';
import { MedicationList } from '../components/MedicationList';
import { PatientScopeEmpty } from '../components/PatientScopeEmpty';
import { Alert, ClinicalDisclaimer } from '../components/ui/Alert';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState, LoadingBlock, PageHeader, SectionHeading, Skeleton, Stat } from '../components/ui/Layout';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatAppointment, formatDate, recordTypeLabel } from '../lib/format';
import { usePatientScope } from '../lib/usePatientScope';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { patientId, isStaff } = usePatientScope();

  const metrics = useQuery({
    queryKey: ['dashboard-metrics', patientId],
    queryFn: () => api.records.dashboardMetrics(patientId as string),
    enabled: Boolean(patientId),
  });

  const medications = useQuery({
    queryKey: ['medications', patientId],
    queryFn: () => api.records.medications(patientId as string),
    enabled: Boolean(patientId),
  });

  const preview = useQuery({
    queryKey: ['timeline-preview', patientId],
    queryFn: () => api.records.timelinePreview(patientId as string, 6),
    enabled: Boolean(patientId),
  });

  const reminderStats = useQuery({
    queryKey: ['reminder-stats', patientId],
    queryFn: () => api.reminders.stats(patientId as string),
    enabled: Boolean(patientId),
  });

  if (!patientId) return <PatientScopeEmpty />;

  const firstName = user?.patient?.firstName ?? user?.name.split(' ')[0] ?? 'there';
  const data = metrics.data;
  const activeMedications = medications.data?.active ?? [];
  const overdue = reminderStats.data?.overdue ?? 0;

  return (
    <AppShell>
      <Head>
        <title>Dashboard · MediFlow</title>
      </Head>

      <PageHeader
        eyebrow={`Dashboard · ${formatDate(new Date())}`}
        title={isStaff ? 'Patient record' : `${greeting()}, ${firstName}.`}
        description={
          isStaff
            ? 'A single view of the recorded plan. All content is drawn from this patient’s saved documents.'
            : 'Here is the record as it stands today — what is active, what is coming up, and what needs a look.'
        }
        actions={
          <>
            <ButtonLink href={isStaff ? `/upload?patientId=${patientId}` : '/upload'} variant="primary">
              Add a document
            </ButtonLink>
            <ButtonLink href={isStaff ? `/timeline?patientId=${patientId}` : '/timeline'} variant="quiet">
              Open timeline
            </ButtonLink>
          </>
        }
      />

      {metrics.isError ? (
        <Alert tone="danger" title="Could not load the dashboard" className="mt-6">
          {errorMessage(metrics.error)}
        </Alert>
      ) : null}

      {/* Metrics */}
      <section aria-label="Record summary" className="mt-8">
        {metrics.isLoading ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="border-t border-ink pt-3">
                <Skeleton className="h-10 w-16" />
                <Skeleton className="mt-3 h-3 w-24" />
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat value={data.activeMedications} label="Active medicines" accent="pine" note="Current courses on file" />
            <Stat
              value={data.pendingAppointments}
              label="Upcoming visits"
              note={data.upcomingFollowUps > 0 ? `${data.upcomingFollowUps} in the next 30 days` : 'None in the next 30 days'}
            />
            <Stat value={data.recordsUploaded} label="Documents" note="Saved to this record" />
            <Stat
              value={data.pendingReminders}
              label="Pending reminders"
              accent={overdue > 0 ? 'clay' : 'ink'}
              note={overdue > 0 ? `${overdue} overdue` : 'None overdue'}
            />
          </div>
        ) : null}
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.55fr_1fr] lg:gap-14">
        <div className="space-y-12">
          {/* Medicines */}
          <section aria-labelledby="medicines-heading">
            <SectionHeading
              number="01"
              id="medicines-heading"
              title="Active medicines"
              description="Exactly as printed on the saved prescriptions. MediFlow never adjusts a dose."
              actions={<span className="tag-pine">{activeMedications.length} active</span>}
            />
            <div className="mt-5">
              {medications.isLoading ? (
                <LoadingBlock label="Loading medicines" />
              ) : medications.isError ? (
                <Alert tone="danger" title="Medicines unavailable">
                  {errorMessage(medications.error)}
                </Alert>
              ) : (
                <MedicationList medications={activeMedications} />
              )}
            </div>
          </section>

          {/* Recent documents */}
          <section aria-labelledby="documents-heading">
            <SectionHeading
              number="02"
              id="documents-heading"
              title="Recent documents"
              description="The source material behind every summary on this page."
              actions={
                <ButtonLink href={isStaff ? `/upload?patientId=${patientId}` : '/upload'} variant="quiet">
                  Upload
                </ButtonLink>
              }
            />
            <div className="mt-5">
              {preview.isLoading ? (
                <LoadingBlock label="Loading documents" />
              ) : preview.isError ? (
                <Alert tone="danger" title="Documents unavailable">
                  {errorMessage(preview.error)}
                </Alert>
              ) : (preview.data?.records.length ?? 0) === 0 ? (
                <EmptyState
                  title="No documents yet"
                  description="Upload a prescription, lab report or discharge summary. You will review what was extracted before it is saved."
                  action={
                    <ButtonLink href={isStaff ? `/upload?patientId=${patientId}` : '/upload'}>
                      Add the first document
                    </ButtonLink>
                  }
                />
              ) : (
                <ol className="divide-y divide-rule border-y border-rule">
                  {preview.data?.records.map((record) => (
                    <li key={record.id} className="py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                          {recordTypeLabel(record.recordType)}
                        </p>
                        <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                          {formatDate(record.recordDate)}
                        </p>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-ink">{record.description}</p>
                      <p className="mt-1 text-xs text-ink-faint">
                        {record.provider
                          ? `Dr. ${record.provider.firstName} ${record.provider.lastName}`
                          : 'Clinician not recorded'}
                        {record.facility ? ` · ${record.facility.name}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          {/* Activity */}
          <section aria-labelledby="activity-heading">
            <SectionHeading
              number="03"
              id="activity-heading"
              title="Agent activity"
              description="A plain-language log of what each agent did, and when."
            />
            <div className="mt-5">
              <AgentActivityLog patientId={patientId} />
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          {/* Next appointment */}
          <section className="border border-ink bg-surface p-6">
            <p className="eyebrow">Next appointment</p>
            {metrics.isLoading ? (
              <LoadingBlock label="Loading next appointment" />
            ) : data?.nextAppointment ? (
              <>
                <p className="mt-3 font-display text-2xl leading-tight text-ink">
                  {formatAppointment(
                    data.nextAppointment.appointmentDate,
                    data.nextAppointment.appointmentTime
                  )}
                </p>
                <p className="mt-2 text-sm text-ink-soft">
                  Dr. {data.nextAppointment.provider.firstName} {data.nextAppointment.provider.lastName} ·{' '}
                  {data.nextAppointment.provider.specialty}
                </p>
                <p className="mt-1 text-sm text-ink-faint">{data.nextAppointment.facility.name}</p>
                {data.nextAppointment.reason ? (
                  <p className="mt-3 border-t border-rule pt-3 text-sm text-ink-soft">
                    {data.nextAppointment.reason}
                  </p>
                ) : null}
                <ButtonLink
                  href={isStaff ? `/appointments?patientId=${patientId}` : '/appointments'}
                  variant="quiet"
                  className="mt-4 w-full"
                >
                  Manage appointments
                </ButtonLink>
              </>
            ) : (
              <>
                <p className="mt-3 font-display text-xl text-ink">Nothing scheduled.</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Book a visit through the navigator or the appointments page.
                </p>
                <ButtonLink href="/appointments" variant="quiet" className="mt-4 w-full">
                  Book an appointment
                </ButtonLink>
              </>
            )}
          </section>

          {/* Attention */}
          <section className="border border-rule bg-paper p-6">
            <p className="eyebrow">Needs a look</p>
            <ul className="mt-3 space-y-3 text-sm">
              {overdue > 0 ? (
                <li className="flex items-start justify-between gap-3">
                  <span className="text-ink-soft">Overdue reminders</span>
                  <Link href="/reminders" className="font-mono text-xs text-crimson underline underline-offset-4">
                    {overdue} to review
                  </Link>
                </li>
              ) : null}
              {data && data.recordsUploaded === 0 ? (
                <li className="flex items-start justify-between gap-3">
                  <span className="text-ink-soft">No documents on file</span>
                  <Link href="/upload" className="font-mono text-xs text-pine underline underline-offset-4">
                    Upload
                  </Link>
                </li>
              ) : null}
              {data && data.activeMedications > 0 ? (
                <li className="flex items-start justify-between gap-3">
                  <span className="text-ink-soft">Medicine list</span>
                  <Link href="/timeline" className="font-mono text-xs text-pine underline underline-offset-4">
                    Check duplicates
                  </Link>
                </li>
              ) : null}
              {overdue === 0 && (data?.recordsUploaded ?? 0) > 0 && (data?.activeMedications ?? 0) === 0 ? (
                <li className="text-ink-faint">Nothing outstanding from the recorded plan.</li>
              ) : null}
              {overdue === 0 && !data ? <li className="text-ink-faint">Loading checks…</li> : null}
            </ul>
          </section>

          {/* Insight */}
          <section className="border border-rule bg-surface p-6">
            <InsightPanel patientId={patientId} />
          </section>

          {/* Quick links */}
          <nav aria-label="Shortcuts" className="border-t border-ink pt-4">
            <p className="eyebrow">Shortcuts</p>
            <ul className="mt-2 divide-y divide-rule">
              {[
                ['/navigator', 'Find the right next step'],
                ['/timeline', 'Review the chronology'],
                ['/facilities', 'Facilities and emergency care'],
                ['/translate', 'Explain a prescription'],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={isStaff ? `${href}?patientId=${patientId}` : href}
                    className="flex items-center justify-between py-2.5 text-sm text-ink-soft hover:text-ink"
                  >
                    {label}
                    <span aria-hidden="true" className="font-mono text-xs text-ink-faint">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <ClinicalDisclaimer />
        </aside>
      </div>
    </AppShell>
  );
}
