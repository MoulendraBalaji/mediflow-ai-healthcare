import Head from 'next/head';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { PatientScopeEmpty } from '../components/PatientScopeEmpty';
import { Alert, ClinicalDisclaimer } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { EmptyState, PageHeader, SectionHeading, Skeleton } from '../components/ui/Layout';
import { api, errorMessage } from '../lib/api';
import {
  appointmentStatusClass,
  APPOINTMENT_STATUS_LABELS,
  formatAppointment,
  formatTime,
  todayInput,
  urgencyClass,
  URGENCY_LABELS,
} from '../lib/format';
import type { Appointment, Urgency } from '../lib/types';
import { usePatientScope } from '../lib/usePatientScope';

type Filter = 'UPCOMING' | 'PAST' | 'ALL';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'PAST', label: 'Past' },
  { value: 'ALL', label: 'All' },
];

const URGENCY_OPTIONS: Urgency[] = ['LOW', 'MEDIUM', 'HIGH'];

function tomorrowInput(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isUpcoming(appointment: Appointment): boolean {
  if (appointment.status !== 'SCHEDULED') return false;
  return appointment.appointmentDate.slice(0, 10) >= todayInput();
}

export default function AppointmentsPage() {
  const { patientId, isStaff } = usePatientScope();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>('UPCOMING');
  const [providerId, setProviderId] = useState('');
  const [date, setDate] = useState(tomorrowInput());
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('MEDIUM');
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const appointmentsQuery = useQuery({
    queryKey: ['appointments', patientId],
    queryFn: () => api.appointments.list(patientId as string),
    enabled: Boolean(patientId),
  });

  const providersQuery = useQuery({
    queryKey: ['appointment-providers'],
    queryFn: () => api.appointments.providers(),
    staleTime: 60_000,
    enabled: Boolean(patientId),
  });

  const rescheduling = rescheduleId
    ? appointmentsQuery.data?.appointments.find((appointment) => appointment.id === rescheduleId) ?? null
    : null;

  const activeProviderId = rescheduling ? rescheduling.providerId : providerId;
  const slotsQuery = useQuery({
    queryKey: ['appointment-slots', activeProviderId, date],
    queryFn: () => api.appointments.slots(activeProviderId, date),
    enabled: Boolean(activeProviderId && date),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['appointments', patientId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-metrics', patientId] });
    void queryClient.invalidateQueries({ queryKey: ['reminder-stats', patientId] });
  };

  const resetForm = () => {
    setProviderId('');
    setDate(tomorrowInput());
    setTime('');
    setReason('');
    setUrgency('MEDIUM');
    setRescheduleId(null);
    setFormError(null);
  };

  const book = useMutation({
    mutationFn: () => {
      if (!patientId) throw new Error('Choose a patient first');
      if (!providerId) throw new Error('Choose a clinician');
      if (!date) throw new Error('Choose a date');
      if (!time) throw new Error('Choose an available time');
      return api.appointments.create({
        patientId,
        providerId,
        appointmentDate: date,
        appointmentTime: time,
        reason: reason.trim() || undefined,
        urgency,
      });
    },
    onSuccess: (result) => {
      refresh();
      setNotice(
        `Booked with Dr. ${result.appointment.provider.firstName} ${result.appointment.provider.lastName} on ${formatAppointment(
          result.appointment.appointmentDate,
          result.appointment.appointmentTime
        )}.`
      );
      resetForm();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const move = useMutation({
    mutationFn: () => {
      if (!rescheduleId) throw new Error('Choose a visit to move');
      if (!date) throw new Error('Choose a date');
      if (!time) throw new Error('Choose an available time');
      return api.appointments.reschedule(rescheduleId, {
        appointmentDate: date,
        appointmentTime: time,
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: (result) => {
      refresh();
      setNotice(
        `Moved to ${formatAppointment(result.appointment.appointmentDate, result.appointment.appointmentTime)}.`
      );
      resetForm();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.appointments.cancel(id),
    onSuccess: (result) => {
      refresh();
      setNotice(
        result.alreadyCancelled
          ? 'That visit was already cancelled.'
          : 'The visit has been cancelled. Nothing else was changed.'
      );
      if (rescheduleId === result.appointment.id) resetForm();
    },
    onError: (error) => setNotice(errorMessage(error)),
  });

  if (!patientId) return <PatientScopeEmpty />;

  const appointments = appointmentsQuery.data?.appointments ?? [];
  const providers = providersQuery.data?.providers ?? [];
  const filtered = appointments.filter((appointment) =>
    filter === 'ALL' ? true : filter === 'UPCOMING' ? isUpcoming(appointment) : !isUpcoming(appointment)
  );
  const upcomingCount = appointments.filter(isUpcoming).length;
  const busy = book.isPending || move.isPending;

  const startReschedule = (appointment: Appointment) => {
    setRescheduleId(appointment.id);
    setDate(appointment.appointmentDate.slice(0, 10));
    setTime(appointment.appointmentTime);
    setReason(appointment.reason ?? '');
    setFormError(null);
    setNotice(null);
  };

  const askCancel = (appointment: Appointment) => {
    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm(
            `Cancel the visit with Dr. ${appointment.provider.firstName} ${appointment.provider.lastName} on ${formatAppointment(
              appointment.appointmentDate,
              appointment.appointmentTime
            )}?`
          );
    if (confirmed) cancel.mutate(appointment.id);
  };

  const onSubmit = () => {
    setFormError(null);
    setNotice(null);
    if (rescheduleId) move.mutate();
    else book.mutate();
  };

  return (
    <AppShell>
      <Head>
        <title>Appointments · MediFlow</title>
      </Head>

      <PageHeader
        eyebrow="Appointments"
        title={rescheduling ? 'Move this visit.' : 'Plan the next visit.'}
        description={
          isStaff
            ? 'Book, move or cancel a recorded visit for this patient. Only the clinic’s own schedule is used — no third-party directory.'
            : 'Choose a clinician and a free slot. The visit is written to your record immediately, so the plan and the timeline stay in step.'
        }
        meta={
          <>
            <span className="tag-neutral">{upcomingCount} upcoming</span>
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
              No reminder is sent automatically
            </span>
          </>
        }
      />

      {notice ? (
        <Alert tone="success" title="Appointment update" className="mt-6">
          {notice}
        </Alert>
      ) : null}

      {appointmentsQuery.isError ? (
        <Alert tone="danger" title="Could not load appointments" className="mt-6">
          {errorMessage(appointmentsQuery.error)}
        </Alert>
      ) : null}

      <div className="mt-10 grid gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:gap-14">
        <section aria-labelledby="visits-heading">
          <SectionHeading
            number="01"
            id="visits-heading"
            title="Recorded visits"
            description="Every entry comes from the saved appointment record. Cancelling keeps the entry and marks it cancelled."
            actions={
              <div className="flex flex-wrap gap-1" role="group" aria-label="Filter appointments">
                {FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    aria-pressed={filter === option.value}
                    className={
                      filter === option.value
                        ? 'border border-ink bg-ink px-3 py-1.5 font-mono text-2xs uppercase tracking-[0.1em] text-paper'
                        : 'border border-rule bg-surface px-3 py-1.5 font-mono text-2xs uppercase tracking-[0.1em] text-ink-soft hover:border-ink'
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            }
          />

          <div className="mt-5">
            {appointmentsQuery.isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={filter === 'UPCOMING' ? 'Nothing scheduled' : 'No visits in this view'}
                description={
                  filter === 'UPCOMING'
                    ? 'Use the booking panel to choose a clinician and a free slot.'
                    : 'Completed, cancelled and past visits will appear here once they exist.'
                }
              />
            ) : (
              <ol className="divide-y divide-rule border-y border-rule">
                {filtered.map((appointment) => {
                  const upcoming = isUpcoming(appointment);
                  return (
                    <li key={appointment.id} className="py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                            {formatAppointment(appointment.appointmentDate, appointment.appointmentTime)}
                          </p>
                          <h3 className="mt-1.5 font-display text-xl leading-tight text-ink">
                            Dr. {appointment.provider.firstName} {appointment.provider.lastName}
                          </h3>
                          <p className="mt-0.5 text-sm text-ink-soft">
                            {appointment.provider.specialty} · {appointment.facility.name}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={urgencyClass(appointment.urgency)}>
                            {URGENCY_LABELS[appointment.urgency]}
                          </span>
                          <span className={appointmentStatusClass(appointment.status)}>
                            {APPOINTMENT_STATUS_LABELS[appointment.status]}
                          </span>
                        </div>
                      </div>

                      {appointment.reason ? (
                        <p className="mt-3 border-l-2 border-rule-strong pl-3 text-sm leading-relaxed text-ink-soft">
                          {appointment.reason}
                        </p>
                      ) : null}

                      {appointment.rescheduledFrom ? (
                        <p className="mt-2 font-mono text-2xs uppercase tracking-[0.08em] text-ink-faint">
                          Moved from {appointment.rescheduledFrom}
                        </p>
                      ) : null}

                      {upcoming ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="quiet"
                            onClick={() => startReschedule(appointment)}
                            disabled={busy}
                          >
                            Move visit
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => askCancel(appointment)}
                            loading={cancel.isPending && cancel.variables === appointment.id}
                            disabled={busy}
                          >
                            Cancel visit
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-ink bg-surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">{rescheduling ? 'Reschedule' : 'Book'}</p>
                <h2 className="mt-1 font-display text-2xl text-ink">
                  {rescheduling ? 'Choose a new slot' : 'Choose a clinician'}
                </h2>
              </div>
              {rescheduling ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-soft underline decoration-rule-strong underline-offset-4 hover:text-ink"
                >
                  Clear
                </button>
              ) : null}
            </div>

            {rescheduling ? (
              <p className="mt-3 border border-rule bg-paper px-3 py-2 text-sm text-ink-soft">
                Dr. {rescheduling.provider.firstName} {rescheduling.provider.lastName} ·{' '}
                {rescheduling.provider.specialty}
                <br />
                Currently {formatAppointment(rescheduling.appointmentDate, rescheduling.appointmentTime)}
              </p>
            ) : (
              <div className="mt-4">
                <SelectField
                  label="Clinician"
                  value={providerId}
                  onChange={(event) => {
                    setProviderId(event.target.value);
                    setTime('');
                    setFormError(null);
                  }}
                  hint={
                    providersQuery.isError
                      ? 'The clinician directory is unavailable right now.'
                      : 'Only clinicians in the clinic directory are listed.'
                  }
                >
                  <option value="">Choose a clinician</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      Dr. {provider.firstName} {provider.lastName} · {provider.specialty}
                      {provider.facility ? ` · ${provider.facility.name}` : ''}
                    </option>
                  ))}
                </SelectField>
              </div>
            )}

            <div className="mt-4">
              <TextField
                label="Date"
                type="date"
                min={todayInput()}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setTime('');
                  setFormError(null);
                }}
              />
            </div>

            <div className="mt-4">
              <p className="field-label">Available times</p>
              {!activeProviderId ? (
                <p className="text-sm text-ink-faint">Choose a clinician to see the day’s slots.</p>
              ) : slotsQuery.isLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-9 w-full" />
                  ))}
                </div>
              ) : slotsQuery.isError ? (
                <p className="text-sm text-crimson">{errorMessage(slotsQuery.error)}</p>
              ) : (slotsQuery.data?.slots.length ?? 0) === 0 ? (
                <p className="text-sm text-ink-faint">No slots are published for this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Available times">
                  {slotsQuery.data?.slots.map((slot) => {
                    const selected = time === slot.time;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        aria-pressed={selected}
                        disabled={!slot.available}
                        onClick={() => {
                          setTime(slot.time);
                          setFormError(null);
                        }}
                        className={
                          selected
                            ? 'border border-pine bg-pine px-2 py-2 font-mono text-xs text-white'
                            : slot.available
                              ? 'border border-rule bg-surface px-2 py-2 font-mono text-xs text-ink-soft hover:border-ink hover:text-ink'
                              : 'cursor-not-allowed border border-rule bg-paper px-2 py-2 font-mono text-xs text-ink-faint line-through'
                        }
                        title={slot.reason ?? undefined}
                      >
                        {formatTime(slot.time)}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="hint">
                Slots run from 9:00 am to 4:30 pm in 30-minute steps. Booked and past times cannot be
                chosen.
              </p>
            </div>

            {!rescheduling ? (
              <div className="mt-4">
                <SelectField
                  label="How soon"
                  value={urgency}
                  onChange={(event) => setUrgency(event.target.value as Urgency)}
                  hint="This labels the request; it does not move you up a queue."
                >
                  {URGENCY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {URGENCY_LABELS[option]}
                    </option>
                  ))}
                </SelectField>
              </div>
            ) : null}

            <div className="mt-4">
              <TextAreaField
                label="Reason for the visit"
                optional
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="What should the clinician know before the visit?"
              />
            </div>

            {formError ? (
              <Alert tone="danger" title="Could not save the appointment" className="mt-4">
                {formError}
              </Alert>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
              <Button onClick={onSubmit} loading={busy} disabled={!time || (!rescheduling && !providerId)}>
                {rescheduling ? 'Confirm new time' : 'Confirm booking'}
              </Button>
              {rescheduling ? (
                <Button variant="quiet" onClick={resetForm} disabled={busy}>
                  Keep the current time
                </Button>
              ) : null}
            </div>

            <p className="mt-3 text-xs leading-relaxed text-ink-faint">
              {rescheduling
                ? 'The previous time is kept as a reference on the appointment. The change takes effect immediately.'
                : 'Booking writes the visit to the record and clears any stale dashboard counts. No confirmation email is sent.'}
            </p>
          </div>

          <ClinicalDisclaimer className="mt-6" />
        </aside>
      </div>
    </AppShell>
  );
}
