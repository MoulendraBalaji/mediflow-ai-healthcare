import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { MedicationList } from '../components/MedicationList';
import { Alert, ClinicalDisclaimer, ModeNote } from '../components/ui/Alert';
import { ButtonLink } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
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
import { formatAppointment, formatDate, recordTypeLabel, titleCase } from '../lib/format';
import { usePatientScope } from '../lib/usePatientScope';

export default function DoctorPortalPage() {
  const { user } = useAuth();
  const { patientId } = usePatientScope();
  const router = useRouter();
  const [search, setSearch] = useState('');

  const isDoctor = user?.role === 'DOCTOR';

  const patientsQuery = useQuery({
    queryKey: ['doctor-patients'],
    queryFn: () => api.providers.myPatients(),
    enabled: isDoctor,
  });

  const summaryQuery = useQuery({
    queryKey: ['patient-summary', patientId],
    queryFn: () => api.providers.summary(patientId as string),
    enabled: isDoctor && Boolean(patientId),
  });

  if (!isDoctor) {
    return (
      <AppShell>
        <Head>
          <title>Patient panel · MediFlow</title>
        </Head>
        <PageHeader
          eyebrow="Patient panel"
          title="Clinician access only."
          description="This panel lists patients through a recorded care relationship. Administrator and patient accounts use their own screens."
        />
        <div className="mt-8">
          <EmptyState
            title="This screen is not for your role"
            description="If you are a clinician, sign in with your clinician account. If you are an administrator, open analytics."
            action={<ButtonLink href="/admin">Open analytics</ButtonLink>}
          />
        </div>
      </AppShell>
    );
  }

  const patients = patientsQuery.data?.patients ?? [];
  const summary = summaryQuery.data;
  const filtered = patients.filter((patient) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(needle);
  });
  const withUpcoming = patients.filter((patient) => patient.nextAppointment !== null).length;
  const withActiveMedicines = patients.filter((patient) => patient.counts.activeMedications > 0).length;

  const selectPatient = (id: string) => {
    void router.replace({ pathname: '/doctor-portal', query: { patientId: id } }, undefined, {
      shallow: true,
    });
  };

  return (
    <AppShell>
      <Head>
        <title>Patient panel · MediFlow</title>
      </Head>

      <PageHeader
        eyebrow="Patient panel"
        title="Patients in your recorded care."
        description="Only patients with a recorded access grant, an appointment or a document you signed appear here. There is no search across the whole database."
        actions={
          <ButtonLink href="/translate" variant="quiet">
            Explain a prescription
          </ButtonLink>
        }
        meta={
          <>
            <span className="tag-neutral">{patients.length} patients</span>
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
              Access is checked on every request
            </span>
          </>
        }
      />

      {patientsQuery.isError ? (
        <Alert tone="danger" title="Could not load your patient panel" className="mt-6">
          {errorMessage(patientsQuery.error)}
        </Alert>
      ) : null}

      <section aria-label="Panel summary" className="mt-8">
        {patientsQuery.isLoading ? (
          <div className="grid grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Stat value={patients.length} label="Linked patients" accent="pine" note="Grant, visit or document" />
            <Stat value={withUpcoming} label="With an upcoming visit" note="Scheduled from today onward" />
            <Stat value={withActiveMedicines} label="On an active medicine" note="As recorded in a prescription" />
          </div>
        )}
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
        <section aria-labelledby="panel-list-heading">
          <SectionHeading
            number="01"
            id="panel-list-heading"
            title="Your patients"
            description="Choose a patient to open the pre-consultation summary."
          />

          <div className="mt-4">
            <TextField
              label="Filter by name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the linked list"
              maxLength={120}
            />
          </div>

          <div className="mt-4">
            {patientsQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 w-full" />
                ))}
              </div>
            ) : patients.length === 0 ? (
              <EmptyState
                title="No linked patients"
                description="A patient appears here when an access grant, appointment or signed document connects them to your clinician profile."
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                title="No name matches"
                description="Clear the filter to see every linked patient."
              />
            ) : (
              <ul className="divide-y divide-rule border-y border-rule">
                {filtered.map((patient) => {
                  const selected = patient.id === patientId;
                  return (
                    <li key={patient.id}>
                      <button
                        type="button"
                        onClick={() => selectPatient(patient.id)}
                        aria-pressed={selected}
                        className={
                          selected
                            ? 'w-full border-l-2 border-pine bg-pine-light px-4 py-4 text-left'
                            : 'w-full border-l-2 border-transparent px-4 py-4 text-left hover:bg-surface'
                        }
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-display text-lg leading-tight text-ink">
                            {patient.firstName} {patient.lastName}
                          </span>
                          <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                            {patient.ageBand}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-soft">
                          {patient.counts.records} documents · {patient.counts.activeMedications} active
                          medicines
                        </p>
                        {patient.nextAppointment ? (
                          <p className="mt-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-pine">
                            Next {formatAppointment(
                              patient.nextAppointment.appointmentDate,
                              patient.nextAppointment.appointmentTime
                            )}
                          </p>
                        ) : (
                          <p className="mt-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-ink-faint">
                            No upcoming visit
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <ClinicalDisclaimer className="mt-8 lg:hidden" />
        </section>

        <section aria-labelledby="summary-heading">
          <SectionHeading
            number="02"
            id="summary-heading"
            title="Pre-consultation summary"
            description="Facts are taken from saved documents and visits. Wording may be AI-assisted; nothing clinical is generated from an empty record."
          />

          <div className="mt-5">
            {!patientId ? (
              <EmptyState
                title="Choose a patient"
                description="Select a patient from the linked list to see their active medicines, recorded allergies and recent documents."
              />
            ) : summaryQuery.isLoading ? (
              <div className="border border-rule bg-surface p-6">
                <LoadingBlock label="Loading the patient summary" />
              </div>
            ) : summaryQuery.isError ? (
              <Alert tone="danger" title="This summary cannot be opened">
                {errorMessage(summaryQuery.error)}
              </Alert>
            ) : summary ? (
              <div className="space-y-8">
                <div className="border border-ink bg-surface p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="eyebrow">Patient</p>
                      <h2 className="mt-1 font-display text-3xl leading-tight text-ink">
                        {summary.patient.firstName} {summary.patient.lastName}
                      </h2>
                      <p className="mt-1 text-sm text-ink-soft">
                        {summary.patient.ageBand} · {titleCase(summary.patient.gender)} · born{' '}
                        {formatDate(summary.patient.dateOfBirth)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ButtonLink href={`/dashboard?patientId=${summary.patient.id}`} variant="quiet">
                        Dashboard
                      </ButtonLink>
                      <ButtonLink href={`/timeline?patientId=${summary.patient.id}`} variant="quiet">
                        Timeline
                      </ButtonLink>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-4 border-t border-rule pt-4 sm:grid-cols-2">
                    <div>
                      <dt className="data-key">Contact</dt>
                      <dd className="data-value">{summary.patient.contactNumber || 'Not recorded'}</dd>
                    </div>
                    <div>
                      <dt className="data-key">Emergency contact</dt>
                      <dd className="data-value">{summary.patient.emergencyContact || 'Not recorded'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="border border-rule bg-paper p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="eyebrow">Recorded summary</p>
                    <ModeNote mode={summary.mode} />
                  </div>
                  <p className="prose-editorial mt-3 text-base">{summary.summary}</p>
                  <p className="mt-3 font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                    Generated {formatDate(summary.generatedAt)} · not a diagnosis or a care order
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="border border-rule bg-surface p-4">
                    <p className="eyebrow">Allergies</p>
                    {summary.allergies.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-faint">None recorded in saved documents.</p>
                    ) : (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {summary.allergies.map((allergy) => (
                          <li key={allergy}>
                            <span className="tag-crimson">{allergy}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="border border-rule bg-surface p-4">
                    <p className="eyebrow">Recorded diagnoses</p>
                    {summary.diagnoses.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-faint">None recorded in saved documents.</p>
                    ) : (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {summary.diagnoses.map((diagnosis) => (
                          <li key={diagnosis}>
                            <span className="tag-neutral">{diagnosis}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div>
                  <SectionHeading
                    title="Active medicines"
                    description="Exactly as recorded. Doses are never adjusted by MediFlow."
                    actions={<span className="tag-pine">{summary.activeMedications.length} active</span>}
                  />
                  <div className="mt-4">
                    <MedicationList
                      medications={summary.activeMedications}
                      emptyTitle="No active medicines recorded"
                      emptyDescription="A medicine appears here after a prescription is extracted and saved."
                    />
                  </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                  <div>
                    <p className="eyebrow">Recent documents</p>
                    {summary.recentRecords.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-faint">No documents on file.</p>
                    ) : (
                      <ol className="mt-2 divide-y divide-rule border-y border-rule">
                        {summary.recentRecords.map((record) => (
                          <li key={record.id} className="py-3">
                            <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                              {formatDate(record.recordDate)} · {recordTypeLabel(record.recordType)}
                            </p>
                            <p className="mt-1 text-sm text-ink">{record.description}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  <div>
                    <p className="eyebrow">Recent visits</p>
                    {summary.recentAppointments.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-faint">No visits on file.</p>
                    ) : (
                      <ol className="mt-2 divide-y divide-rule border-y border-rule">
                        {summary.recentAppointments.map((appointment) => (
                          <li key={appointment.id} className="py-3">
                            <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                              {formatAppointment(appointment.appointmentDate, appointment.appointmentTime)}
                            </p>
                            <p className="mt-1 text-sm text-ink">
                              Dr. {appointment.provider.firstName} {appointment.provider.lastName} ·{' '}
                              {appointment.status.toLowerCase()}
                            </p>
                            {appointment.reason ? (
                              <p className="mt-0.5 text-xs text-ink-soft">{appointment.reason}</p>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-rule pt-5">
                  <ButtonLink href={`/upload?patientId=${summary.patient.id}`}>Add a document</ButtonLink>
                  <ButtonLink href={`/appointments?patientId=${summary.patient.id}`} variant="quiet">
                    Appointments
                  </ButtonLink>
                  <ButtonLink href={`/reminders?patientId=${summary.patient.id}`} variant="quiet">
                    Reminders
                  </ButtonLink>
                  <Link
                    href={`/navigator?patientId=${summary.patient.id}`}
                    className="btn-link ml-auto self-center text-sm"
                  >
                    Open navigator
                  </Link>
                </div>

                <ClinicalDisclaimer />
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
