import Head from 'next/head';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppShell } from '../components/AppShell';
import { PatientScopeEmpty } from '../components/PatientScopeEmpty';
import { Alert, ClinicalDisclaimer, ModeNote } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState, LoadingBlock, PageHeader, SectionHeading, Skeleton, Stat } from '../components/ui/Layout';
import { api, errorMessage } from '../lib/api';
import { formatDate, recordTypeLabel } from '../lib/format';
import type { TimelineAnalysis } from '../lib/types';
import { usePatientScope } from '../lib/usePatientScope';

export default function TimelinePage() {
  const { patientId, isStaff } = usePatientScope();

  const preview = useQuery({
    queryKey: ['timeline-preview', patientId, 50],
    queryFn: () => api.records.timelinePreview(patientId as string, 50),
    enabled: Boolean(patientId),
  });

  const analysis = useMutation<TimelineAnalysis, unknown, void>({
    mutationFn: () => api.agents.timeline(patientId as string),
  });

  if (!patientId) return <PatientScopeEmpty />;

  const result = analysis.data;
  const previewRecords = preview.data?.records ?? [];
  const duplicateFlags = preview.data?.duplicateFlags ?? [];

  return (
    <AppShell>
      <Head>
        <title>Timeline · MediFlow</title>
      </Head>

      <PageHeader
        eyebrow="Chronology"
        title="The record, in time."
        description="Every saved document in order, with deterministic checks for long gaps, duplicate courses and rule-based interactions. No model writes the findings."
        actions={
          <>
            <Button onClick={() => analysis.mutate()} loading={analysis.isPending}>
              {result ? 'Run analysis again' : 'Run timeline analysis'}
            </Button>
            <ButtonLink href={isStaff ? `/upload?patientId=${patientId}` : '/upload'} variant="quiet">
              Add document
            </ButtonLink>
          </>
        }
        meta={
          <>
            <span className="tag-neutral">{previewRecords.length} documents</span>
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
              Rule-based checks · no model used
            </span>
          </>
        }
      />

      {analysis.isError ? (
        <Alert tone="danger" title="Analysis failed" className="mt-6">
          {errorMessage(analysis.error)}
        </Alert>
      ) : null}

      {preview.isError ? (
        <Alert tone="danger" title="Could not load the record" className="mt-6">
          {errorMessage(preview.error)}
        </Alert>
      ) : null}

      {duplicateFlags.length > 0 && !result ? (
        <Alert tone="warning" title="Possible duplicates" className="mt-6">
          These medicine names appear more than once: {duplicateFlags.join(', ')}. Run the analysis for the
          full comparison.
        </Alert>
      ) : null}

      {analysis.isPending ? (
        <section className="mt-8 border border-rule bg-surface p-6">
          <LoadingBlock label="Running timeline analysis" />
          <p className="mt-4 text-xs text-ink-faint">
            Comparing document dates, medicine courses and a small explicit interaction rule set.
          </p>
        </section>
      ) : null}

      {result ? (
        <>
          <section aria-label="Timeline statistics" className="mt-8">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat value={result.statistics.totalRecords} label="Records" accent="pine" />
              <Stat value={result.statistics.gapCount} label="Care gaps" accent={result.statistics.gapCount > 0 ? 'clay' : 'ink'} />
              <Stat
                value={result.statistics.duplicateCount}
                label="Duplicate courses"
                accent={result.statistics.duplicateCount > 0 ? 'ochre' : 'ink'}
              />
              <Stat
                value={result.statistics.conflictCount}
                label="Rule-based flags"
                accent={result.statistics.conflictCount > 0 ? 'crimson' : 'ink'}
              />
            </div>
          </section>

          <section className="mt-10 border border-rule bg-surface p-6 sm:p-7">
            <p className="eyebrow">Narrative summary</p>
            <p className="prose-editorial mt-3 text-base">{result.narrativeSummary}</p>
            <ModeNote mode="rule-based" className="mt-4" />
          </section>

          <div className="mt-12 grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
            <section aria-labelledby="events-heading">
              <SectionHeading
                number="01"
                id="events-heading"
                title="Chronology"
                description="Oldest at the top, so a care story reads forward in time."
              />
              <div className="mt-6">
                {result.sortedEvents.length === 0 ? (
                  <EmptyState
                    title="No events to place"
                    description="Upload a document and it will appear here after review."
                  />
                ) : (
                  <ol className="relative border-l border-rule-strong">
                    {result.sortedEvents.map((event) => (
                      <li key={event.id} className="relative pb-8 pl-6 last:pb-0">
                        <span
                          className="absolute -left-[4.5px] top-1.5 h-2 w-2 bg-pine"
                          aria-hidden="true"
                        />
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint">
                            {formatDate(event.date)} · {recordTypeLabel(event.type)}
                          </p>
                          {event.fileName ? (
                            <span className="font-mono text-2xs text-ink-faint">{event.fileName}</span>
                          ) : null}
                        </div>
                        <h3 className="mt-1.5 text-base font-semibold leading-snug text-ink">
                          {event.description}
                        </h3>
                        <p className="mt-1 text-xs text-ink-faint">
                          {event.providerName || 'Clinician not recorded'}
                          {event.facilityName ? ` · ${event.facilityName}` : ''}
                        </p>
                        {event.medications.length > 0 ? (
                          <ul className="mt-2 flex flex-wrap gap-2">
                            {event.medications.map((medication) => (
                              <li key={medication.id}>
                                <span className="tag-neutral">
                                  {medication.name}
                                  {medication.dosage ? ` · ${medication.dosage}` : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>

            <aside className="space-y-8">
              <section className="border border-rule bg-paper p-6">
                <p className="eyebrow">Care gaps</p>
                {result.gaps.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-soft">
                    No documented gap longer than six months was found.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-4">
                    {result.gaps.map((gap) => (
                      <li key={`${gap.startDate}-${gap.endDate}`} className="border-t border-rule pt-3 first:border-t-0 first:pt-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                            {formatDate(gap.startDate)} → {formatDate(gap.endDate)}
                          </p>
                          <span className={gap.severity === 'high' ? 'tag-clay' : 'tag-ochre'}>
                            {gap.severity}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-ink-soft">{gap.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="border border-rule bg-surface p-6">
                <p className="eyebrow">Duplicate courses</p>
                {result.duplicates.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-soft">No medicine appears in more than one prescription.</p>
                ) : (
                  <ul className="mt-3 space-y-4">
                    {result.duplicates.map((duplicate) => (
                      <li key={duplicate.name} className="border-t border-rule pt-3 first:border-t-0 first:pt-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-ink">{duplicate.name}</p>
                          <span className={duplicate.overlapping ? 'tag-clay' : 'tag-ochre'}>
                            {duplicate.count} entries
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-faint">{duplicate.dates.join(' · ')}</p>
                        <p className="mt-1.5 text-sm text-ink-soft">{duplicate.note}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="border border-rule bg-surface p-6">
                <p className="eyebrow">Rule-based interaction flags</p>
                {result.conflicts.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-soft">
                    No pair from the explicit rule set appears together in the active medicine list.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-4">
                    {result.conflicts.map((conflict) => (
                      <li
                        key={`${conflict.drug1}-${conflict.drug2}`}
                        className="border-t border-rule pt-3 first:border-t-0 first:pt-0"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-ink">
                            {conflict.drug1} + {conflict.drug2}
                          </p>
                          <span className={conflict.severity === 'critical' ? 'tag-crimson' : 'tag-ochre'}>
                            {conflict.severity}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-ink-soft">{conflict.reason}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 border-t border-rule pt-3 text-xs leading-relaxed text-ink-faint">
                  This is a short, explicit rule set — a prompt to ask a pharmacist, not a complete
                  interaction database.
                </p>
              </section>

              <ClinicalDisclaimer />
            </aside>
          </div>
        </>
      ) : null}

      {/* Preview before analysis */}
      {!result && !analysis.isPending ? (
        <section className="mt-10" aria-labelledby="preview-heading">
          <SectionHeading
            number="01"
            id="preview-heading"
            title="Saved documents"
            description="This is the raw chronology. Run the analysis to add gaps, duplicates and interaction checks."
          />
          <div className="mt-6">
            {preview.isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : previewRecords.length === 0 ? (
              <EmptyState
                title="No documents yet"
                description="A timeline starts with one saved document. Upload a prescription, report or discharge summary."
                action={
                  <ButtonLink href={isStaff ? `/upload?patientId=${patientId}` : '/upload'}>
                    Upload a document
                  </ButtonLink>
                }
              />
            ) : (
              <ol className="divide-y divide-rule border-y border-rule">
                {previewRecords.map((record) => (
                  <li key={record.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                    <div>
                      <p className="text-sm font-semibold text-ink">{record.description}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {recordTypeLabel(record.recordType)}
                        {record.provider
                          ? ` · Dr. ${record.provider.firstName} ${record.provider.lastName}`
                          : ''}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                      {formatDate(record.recordDate)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      ) : null}

      <ClinicalDisclaimer className="mt-12 lg:hidden" />
    </AppShell>
  );
}
