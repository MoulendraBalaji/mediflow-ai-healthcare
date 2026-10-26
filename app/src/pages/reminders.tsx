import Head from 'next/head';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { PatientScopeEmpty } from '../components/PatientScopeEmpty';
import { Alert, ClinicalDisclaimer, ModeNote } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { EmptyState, PageHeader, SectionHeading, Stat, Skeleton } from '../components/ui/Layout';
import { api, errorMessage } from '../lib/api';
import {
  formatDate,
  relativeTime,
  REMINDER_TYPE_LABELS,
  scoreTone,
  todayInput,
} from '../lib/format';
import type { CompanionResult, Reminder, ReminderStatus, ReminderType } from '../lib/types';
import { usePatientScope } from '../lib/usePatientScope';

type Filter = 'ALL' | ReminderStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

const REMINDER_TYPES: ReminderType[] = ['MEDICATION', 'APPOINTMENT', 'FOLLOW_UP', 'REFILL'];

const STATUS_CLASS: Record<ReminderStatus, string> = {
  PENDING: 'tag-ochre',
  SENT: 'tag-sky',
  ACKNOWLEDGED: 'tag-pine',
  DISMISSED: 'tag-neutral',
};

function isOverdue(reminder: Reminder): boolean {
  return reminder.status === 'PENDING' && new Date(reminder.dueDate).getTime() < Date.now();
}

export default function RemindersPage() {
  const { patientId, isStaff } = usePatientScope();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>('ALL');
  const [reminderType, setReminderType] = useState<ReminderType>('MEDICATION');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(todayInput());
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const remindersQuery = useQuery({
    queryKey: ['reminders', patientId],
    queryFn: () => api.reminders.list(patientId as string),
    enabled: Boolean(patientId),
  });

  const statsQuery = useQuery({
    queryKey: ['reminder-stats', patientId],
    queryFn: () => api.reminders.stats(patientId as string),
    enabled: Boolean(patientId),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['reminders', patientId] });
    void queryClient.invalidateQueries({ queryKey: ['reminder-stats', patientId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-metrics', patientId] });
    void queryClient.invalidateQueries({ queryKey: ['agent-activity', patientId] });
  };

  const create = useMutation({
    mutationFn: () => {
      if (!patientId) throw new Error('Choose a patient first');
      if (title.trim().length < 2) throw new Error('Add a title of at least two characters');
      if (!dueDate) throw new Error('Choose a due date');
      return api.reminders.create({
        patientId,
        reminderType,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
      });
    },
    onSuccess: (result) => {
      refresh();
      setTitle('');
      setDescription('');
      setDueDate(todayInput());
      setFormError(null);
      setNotice(`Reminder saved for ${formatDate(result.reminder.dueDate)}. No message has been sent.`);
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const generate = useMutation<CompanionResult, unknown, void>({
    mutationFn: () => {
      if (!patientId) throw new Error('Choose a patient first');
      return api.reminders.generate(patientId);
    },
    onSuccess: (result) => {
      refresh();
      setNotice(
        result.created
          ? `${result.created} new ${result.created === 1 ? 'reminder' : 'reminders'} added from the recorded plan.`
          : 'The plan produced no new reminders. Existing entries were left unchanged.'
      );
    },
  });

  const acknowledge = useMutation({
    mutationFn: (id: string) => api.reminders.acknowledge(id),
    onSuccess: () => {
      refresh();
      setNotice('Marked as acknowledged. This records that you saw it; it is not a message receipt.');
    },
    onError: (error) => setNotice(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.reminders.remove(id),
    onSuccess: () => {
      refresh();
      setNotice('Reminder deleted.');
    },
    onError: (error) => setNotice(errorMessage(error)),
  });

  if (!patientId) return <PatientScopeEmpty />;

  const reminders = remindersQuery.data?.reminders ?? [];
  const stats = statsQuery.data;
  const filtered = filter === 'ALL' ? reminders : reminders.filter((reminder) => reminder.status === filter);
  const companion = generate.data;

  const askRemove = (reminder: Reminder) => {
    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm(`Delete the reminder “${reminder.title}”?`);
    if (confirmed) remove.mutate(reminder.id);
  };

  return (
    <AppShell>
      <Head>
        <title>Reminders · MediFlow</title>
      </Head>

      <PageHeader
        eyebrow="Reminders"
        title="Keep the plan visible."
        description="Reminders are built from what is written in the record — a refill date, a follow-up, a visit. MediFlow does not know whether a dose was taken and never claims that it was."
        meta={
          <>
            <span className="tag-neutral">{stats?.pending ?? 0} pending</span>
            {stats && stats.overdue > 0 ? (
              <span className="tag-crimson">{stats.overdue} overdue</span>
            ) : (
              <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                Nothing overdue
              </span>
            )}
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
              No email or SMS is sent
            </span>
          </>
        }
      />

      {notice ? (
        <Alert tone="info" title="Reminder update" className="mt-6">
          {notice}
        </Alert>
      ) : null}

      {remindersQuery.isError ? (
        <Alert tone="danger" title="Could not load reminders" className="mt-6">
          {errorMessage(remindersQuery.error)}
        </Alert>
      ) : null}

      <section aria-label="Reminder summary" className="mt-8">
        {statsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat value={stats.pending} label="Pending" accent={stats.overdue > 0 ? 'clay' : 'ink'} note="Still open" />
            <Stat value={stats.overdue} label="Overdue" accent={stats.overdue > 0 ? 'crimson' : 'ink'} note="Past the due date" />
            <Stat value={stats.acknowledged} label="Acknowledged" accent="pine" note="Seen and marked" />
            <Stat value={stats.total} label="All reminders" note="Including dismissed" />
          </div>
        ) : null}
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:gap-14">
        <section aria-labelledby="list-heading">
          <SectionHeading
            number="01"
            id="list-heading"
            title="Recorded reminders"
            description="Pending items stay here until acknowledged or deleted. A reminder is not evidence of a dose."
            actions={
              <div className="flex flex-wrap gap-1" role="group" aria-label="Filter reminders">
                {FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={filter === option.value}
                    onClick={() => setFilter(option.value)}
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
            {remindersQuery.isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={filter === 'ALL' ? 'No reminders yet' : 'Nothing in this view'}
                description="Generate reminders from the recorded plan, or add one by hand for something the plan does not capture."
              />
            ) : (
              <ol className="divide-y divide-rule border-y border-rule">
                {filtered.map((reminder) => {
                  const overdue = isOverdue(reminder);
                  return (
                    <li key={reminder.id} className="py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="tag-neutral">{REMINDER_TYPE_LABELS[reminder.reminderType]}</span>
                            <span className={STATUS_CLASS[reminder.status]}>
                              {reminder.status.toLowerCase()}
                            </span>
                            {overdue ? <span className="tag-crimson">overdue</span> : null}
                          </div>
                          <h3 className="mt-2 font-display text-xl leading-tight text-ink">
                            {reminder.title}
                          </h3>
                          {reminder.description ? (
                            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                              {reminder.description}
                            </p>
                          ) : null}
                          <p className="mt-2 font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                            Due {formatDate(reminder.dueDate)} · {relativeTime(reminder.dueDate)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {reminder.status !== 'ACKNOWLEDGED' ? (
                            <Button
                              variant="quiet"
                              onClick={() => acknowledge.mutate(reminder.id)}
                              loading={acknowledge.isPending && acknowledge.variables === reminder.id}
                            >
                              Acknowledge
                            </Button>
                          ) : null}
                          <Button
                            variant="danger"
                            onClick={() => askRemove(reminder)}
                            loading={remove.isPending && remove.variables === reminder.id}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <ClinicalDisclaimer className="mt-8 lg:hidden" />
        </section>

        <aside className="space-y-8">
          <section className="border border-ink bg-surface p-5 sm:p-6" aria-labelledby="generate-heading">
            <p className="eyebrow">From the record</p>
            <h2 id="generate-heading" className="mt-1 font-display text-2xl text-ink">
              Generate from the plan
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Looks at active medicine courses, upcoming visits and requests that may need a follow-up. It
              creates only reminders that do not already exist.
            </p>

            {generate.isError ? (
              <Alert tone="danger" title="Could not generate reminders" className="mt-4">
                {errorMessage(generate.error)}
              </Alert>
            ) : null}

            <Button className="mt-4 w-full" onClick={() => generate.mutate()} loading={generate.isPending}>
              {generate.isPending ? 'Reading the plan' : 'Generate reminders'}
            </Button>

            {companion ? (
              <div className="mt-5 border-t border-rule pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="eyebrow">Care engagement</p>
                  <span
                    className={
                      {
                        pine: 'tag-pine',
                        ochre: 'tag-ochre',
                        crimson: 'tag-crimson',
                      }[scoreTone(companion.careEngagementScore)]
                    }
                  >
                    {companion.careEngagementScore}/100
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-faint">{companion.scoreBasis}</p>

                <p className="mt-4 text-sm leading-relaxed text-ink-soft">{companion.aiSummary}</p>
                <ModeNote mode={companion.mode} className="mt-3" />

                {companion.missedAppointments.length > 0 ? (
                  <div className="mt-4 border-t border-rule pt-3">
                    <p className="eyebrow">Recorded as missed</p>
                    <ul className="mt-2 space-y-2 text-sm text-ink-soft">
                      {companion.missedAppointments.map((missed) => (
                        <li key={missed.appointmentId}>
                          {formatDate(missed.date)} · {missed.providerName} — {missed.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {companion.reminders.length > 0 ? (
                  <div className="mt-5">
                    <p className="eyebrow">Suggested entries</p>
                    <ul className="mt-2 divide-y divide-rule border-y border-rule">
                      {companion.reminders.map((reminder) => (
                        <li key={reminder.key} className="py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-ink">{reminder.title}</p>
                            <span className={reminder.existing ? 'tag-neutral' : 'tag-pine'}>
                              {reminder.existing ? 'already on file' : 'added'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                            {reminder.description}
                          </p>
                          <p className="mt-1 font-mono text-2xs uppercase tracking-[0.08em] text-ink-faint">
                            {formatDate(reminder.dueDate)} · {reminder.priority.toLowerCase()} priority
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="border border-rule bg-paper p-5 sm:p-6" aria-labelledby="add-heading">
            <p className="eyebrow">By hand</p>
            <h2 id="add-heading" className="mt-1 font-display text-2xl text-ink">
              Add a reminder
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Use this for something the record does not capture — a question to ask, or a date you do not
              want to lose.
            </p>

            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setFormError(null);
                setNotice(null);
                create.mutate();
              }}
            >
              <SelectField
                label="Type"
                value={reminderType}
                onChange={(event) => setReminderType(event.target.value as ReminderType)}
              >
                {REMINDER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {REMINDER_TYPE_LABELS[type]}
                  </option>
                ))}
              </SelectField>

              <TextField
                label="Title"
                required
                minLength={2}
                maxLength={180}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Ask about the new dose"
              />

              <TextField
                label="Due date"
                type="date"
                required
                min={todayInput()}
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />

              <TextAreaField
                label="Note"
                optional
                rows={3}
                maxLength={600}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Anything that will help you remember why this matters."
              />

              {formError ? (
                <Alert tone="danger" title="Could not save">
                  {formError}
                </Alert>
              ) : null}

              <Button type="submit" loading={create.isPending} className="w-full">
                Save reminder
              </Button>

              <p className="text-xs leading-relaxed text-ink-faint">
                This stores the reminder in MediFlow only. It does not schedule a notification on your
                phone.
              </p>
            </form>
          </section>

          <ClinicalDisclaimer />
        </aside>
      </div>
    </AppShell>
  );
}
