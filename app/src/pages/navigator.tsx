import Head from 'next/head';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type KeyboardEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { PatientScopeEmpty } from '../components/PatientScopeEmpty';
import { Alert, ClinicalDisclaimer, ModeNote } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { EmptyState, PageHeader, SectionHeading } from '../components/ui/Layout';
import { api, errorMessage } from '../lib/api';
import { formatDate, URGENCY_LABELS, urgencyClass } from '../lib/format';
import type { NavigatorResult, Urgency } from '../lib/types';
import { usePatientScope } from '../lib/usePatientScope';

const SYMPTOM_SUGGESTIONS = [
  'chest pain',
  'shortness of breath',
  'headache',
  'fever',
  'cough',
  'stomach pain',
  'joint pain',
  'fatigue',
  'dizziness',
  'skin rash',
  'sore throat',
  'back pain',
  'numbness',
  'blurred vision',
  'weight loss',
];

const CONDITION_SUGGESTIONS = ['diabetes', 'hypertension', 'asthma', 'heart disease', 'kidney disease'];

const EMERGENCY_COPY =
  'Call your local emergency number now. If someone is with you, tell them you need help. Do not drive yourself.';

const TRIAGE_LABEL: Record<NavigatorResult['triageSource'], string> = {
  'red-flag': 'Red-flag rule matched',
  'symptom-map': 'Symptom map',
  general: 'General guidance',
};

function urgencyDescription(urgency: Urgency): string {
  switch (urgency) {
    case 'EMERGENCY':
      return 'This combination matched a fixed emergency rule.';
    case 'HIGH':
      return 'This is flagged for prompt clinical review.';
    case 'MEDIUM':
      return 'This is flagged for a routine appointment soon.';
    default:
      return 'No red flag or urgent pattern matched the rule set.';
  }
}

function TagList({
  values,
  onRemove,
  removeLabel,
  tone,
}: {
  values: string[];
  onRemove: (value: string) => void;
  removeLabel: string;
  tone: 'crimson' | 'pine';
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {values.map((value) => (
        <li key={value}>
          <span className={tone === 'crimson' ? 'tag-crimson' : 'tag-pine'}>
            {value}
            <button
              type="button"
              onClick={() => onRemove(value)}
              className="ml-1 text-ink-soft hover:text-ink"
              aria-label={`${removeLabel}: ${value}`}
            >
              ×
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function NavigatorPage() {
  const { patientId, isStaff } = usePatientScope();
  const queryClient = useQueryClient();

  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomInput, setSymptomInput] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const navigate = useMutation<NavigatorResult, unknown, void>({
    mutationFn: () => {
      if (!patientId) throw new Error('Choose a patient first');
      return api.agents.navigator(symptoms, conditions, patientId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-activity', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-metrics', patientId] });
    },
  });

  if (!patientId) return <PatientScopeEmpty />;

  const result = navigate.data;

  const addSymptom = (value: string) => {
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;
    if (symptoms.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setSymptomInput('');
      return;
    }
    if (symptoms.length >= 10) {
      setLocalError('Add up to 10 symptoms. Group related ones into a single phrase.');
      return;
    }
    setSymptoms((current) => [...current, trimmed]);
    setSymptomInput('');
    setLocalError(null);
    navigate.reset();
  };

  const addCondition = (value: string) => {
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;
    if (conditions.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setConditionInput('');
      return;
    }
    if (conditions.length >= 10) {
      setLocalError('Add up to 10 known conditions.');
      return;
    }
    setConditions((current) => [...current, trimmed]);
    setConditionInput('');
    setLocalError(null);
    navigate.reset();
  };

  const onSymptomKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSymptom(symptomInput);
    }
  };

  const onConditionKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCondition(conditionInput);
    }
  };

  const analyse = () => {
    setLocalError(null);
    if (symptoms.length === 0) {
      setLocalError('Add at least one symptom. The navigator cannot work from an empty list.');
      return;
    }
    navigate.mutate();
  };

  const startOver = () => {
    setSymptoms([]);
    setConditions([]);
    setSymptomInput('');
    setConditionInput('');
    setLocalError(null);
    navigate.reset();
  };

  return (
    <AppShell>
      <Head>
        <title>Care navigator · MediFlow</title>
      </Head>

      <PageHeader
        eyebrow="Navigator"
        title="Find the right next step."
        description="Describe what is happening. A fixed red-flag rule set runs first; a language model may only help explain the result, never set the urgency or change the recommendation."
        meta={
          <>
            <span className="tag-neutral">Rules before model</span>
            <span className="tag-neutral">No diagnosis</span>
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
              {isStaff ? 'Running for the selected patient record' : 'Nothing is saved to your chart'}
            </span>
          </>
        }
      />

      <Alert tone="danger" title="If this may be an emergency" className="mt-6">
        {EMERGENCY_COPY} Symptoms such as chest pain, difficulty breathing, fainting, one-sided weakness or
        heavy bleeding should not wait for this tool.
      </Alert>

      {localError ? (
        <Alert tone="warning" title="Check the symptom list" className="mt-6">
          {localError}
        </Alert>
      ) : null}

      {navigate.isError ? (
        <Alert tone="danger" title="The navigator did not complete" className="mt-6">
          {errorMessage(navigate.error)}
        </Alert>
      ) : null}

      <div className="mt-10 grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <section aria-labelledby="symptoms-heading">
          <SectionHeading
            number="01"
            id="symptoms-heading"
            title="What is happening?"
            description="Use your own words. Add one symptom at a time, up to ten."
          />

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <TextField
                label="Symptom"
                value={symptomInput}
                onChange={(event) => setSymptomInput(event.target.value)}
                onKeyDown={onSymptomKeyDown}
                placeholder="e.g. chest pain, cannot breathe"
                maxLength={200}
              />
            </div>
            <Button variant="secondary" onClick={() => addSymptom(symptomInput)}>
              Add symptom
            </Button>
          </div>

          {symptoms.length > 0 ? (
            <TagList
              values={symptoms}
              onRemove={(value) => {
                setSymptoms((current) => current.filter((item) => item !== value));
                navigate.reset();
              }}
              removeLabel="Remove symptom"
              tone="crimson"
            />
          ) : (
            <p className="mt-3 text-sm text-ink-faint">No symptoms added yet.</p>
          )}

          <div className="mt-6">
            <p className="eyebrow">Common starting points</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SYMPTOM_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addSymptom(suggestion)}
                  className="border border-rule bg-surface px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-rule pt-6">
            <SectionHeading
              number="02"
              id="conditions-heading"
              title="Known conditions"
              description="Optional. These only help the rule set; they are not used to make a diagnosis."
            />

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <TextField
                  label="Condition"
                  optional
                  value={conditionInput}
                  onChange={(event) => setConditionInput(event.target.value)}
                  onKeyDown={onConditionKeyDown}
                  placeholder="e.g. asthma, diabetes"
                  maxLength={160}
                />
              </div>
              <Button variant="quiet" onClick={() => addCondition(conditionInput)}>
                Add condition
              </Button>
            </div>

            {conditions.length > 0 ? (
              <TagList
                values={conditions}
                onRemove={(value) => {
                  setConditions((current) => current.filter((item) => item !== value));
                  navigate.reset();
                }}
                removeLabel="Remove condition"
                tone="pine"
              />
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {CONDITION_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addCondition(suggestion)}
                  className="border border-rule bg-paper px-2.5 py-1 text-xs text-ink-soft hover:border-ink hover:text-ink"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-rule pt-5">
            <Button onClick={analyse} loading={navigate.isPending} disabled={symptoms.length === 0}>
              {navigate.isPending ? 'Checking the rule set' : 'Show the next step'}
            </Button>
            <Button variant="quiet" onClick={startOver} disabled={navigate.isPending}>
              Start over
            </Button>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            Nothing you type here is added to the medical record. The run is logged in the agent activity
            trail so staff can see what was asked.
          </p>
        </section>

        <section aria-labelledby="result-heading">
          <SectionHeading
            number="03"
            id="result-heading"
            title="Guidance"
            description="A recommendation about where to go next — not a diagnosis and not a prescription."
          />

          <div className="mt-5">
            {navigate.isPending ? (
              <div className="border border-rule bg-surface p-6">
                <p className="font-display text-xl text-ink">Checking the red-flag rules…</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Emergency phrases are matched first. If none apply, the symptom map and the optional
                  language model are used only to explain the result.
                </p>
              </div>
            ) : result ? (
              <div className="space-y-6">
                <div
                  className={
                    result.urgency === 'EMERGENCY'
                      ? 'border-l-2 border-y border-r border-crimson bg-crimson-light px-5 py-5'
                      : 'border-l-2 border-y border-r border-rule-strong bg-surface px-5 py-5'
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={urgencyClass(result.urgency)}>
                      {URGENCY_LABELS[result.urgency]}
                    </span>
                    <span className="tag-neutral">{TRIAGE_LABEL[result.triageSource]}</span>
                  </div>
                  <p className="mt-3 font-display text-2xl leading-tight text-ink">
                    {result.urgency === 'EMERGENCY'
                      ? 'This needs emergency help now.'
                      : result.urgency === 'HIGH'
                        ? 'Arrange a prompt clinical review.'
                        : result.urgency === 'MEDIUM'
                          ? 'Book a routine appointment soon.'
                          : 'A routine next step is appropriate.'}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {urgencyDescription(result.urgency)}
                  </p>
                  {result.urgency === 'EMERGENCY' ? (
                    <p className="mt-3 border-t border-crimson/30 pt-3 text-sm font-semibold text-crimson">
                      {EMERGENCY_COPY}
                    </p>
                  ) : null}
                </div>

                {result.redFlags.length > 0 ? (
                  <Alert tone="danger" title="Red flags found">
                    <ul className="mt-1 space-y-1">
                      {result.redFlags.map((flag) => (
                        <li key={flag}>{flag}</li>
                      ))}
                    </ul>
                  </Alert>
                ) : null}

                <div className="border border-rule bg-surface p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="eyebrow">Explanation</p>
                    <ModeNote mode={result.mode} />
                  </div>
                  <p className="prose-editorial mt-3 text-base">{result.aiExplanation}</p>
                </div>

                {result.carePathway.length > 0 ? (
                  <div>
                    <p className="eyebrow">Care pathway</p>
                    <ol className="mt-3 border-t border-ink">
                      {result.carePathway.map((step, index) => (
                        <li key={`${index}-${step}`} className="flex gap-4 border-b border-rule py-3">
                          <span className="font-mono text-2xs text-ink-faint">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="text-sm leading-relaxed text-ink-soft">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                <div>
                  <p className="eyebrow">Suggested specialties</p>
                  {result.recommendations.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-faint">
                      No specialty recommendation was produced for this list.
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-rule border-y border-rule">
                      {result.recommendations.map((recommendation) => (
                        <li key={`${recommendation.specialty}-${recommendation.department}`} className="py-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-ink">
                                {recommendation.specialty}
                              </p>
                              <p className="mt-0.5 font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                                {recommendation.department}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={urgencyClass(recommendation.urgency)}>
                                {URGENCY_LABELS[recommendation.urgency]}
                              </span>
                              <span className="font-mono text-2xs text-ink-faint">
                                {Math.round(recommendation.confidence * 100)}% match
                              </span>
                            </div>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                            {recommendation.reason}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {result.suggestedFacilities.length > 0 ? (
                  <div>
                    <p className="eyebrow">Where to go</p>
                    <ul className="mt-3 space-y-3">
                      {result.suggestedFacilities.map((facility) => (
                        <li key={facility.id} className="border border-rule bg-paper p-4">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-semibold text-ink">{facility.name}</p>
                            <span className="tag-neutral">{facility.type}</span>
                          </div>
                          <p className="mt-1 text-sm text-ink-soft">{facility.address}</p>
                          {facility.contactNumber ? (
                            <p className="mt-1 font-mono text-xs text-ink-soft">{facility.contactNumber}</p>
                          ) : null}
                          <p className="mt-2 text-xs leading-relaxed text-ink-faint">{facility.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="border-t border-rule pt-4">
                  <p className="text-xs leading-relaxed text-ink-soft">{result.disclaimer}</p>
                  <p className="mt-2 font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                    Generated {formatDate(result.generatedAt)} · {result.mode === 'ai' ? 'AI-assisted wording' : 'Rule-based only'}
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No guidance yet"
                description="Add at least one symptom and choose “Show the next step”. This panel will show the urgency, the reason and where to go."
              />
            )}
          </div>

          <div className="mt-8 border border-rule bg-paper p-5">
            <p className="eyebrow">How this works</p>
            <ol className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
              <li className="flex gap-3">
                <span className="font-mono text-2xs text-ink-faint">01</span>
                Fixed red-flag phrases are checked before anything else.
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-2xs text-ink-faint">02</span>
                If none apply, symptoms are mapped to specialties with an explicit rule table.
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-2xs text-ink-faint">03</span>
                A model may rewrite the explanation. It cannot change the urgency, the rule result or the
                recommendation.
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-2xs text-ink-faint">04</span>
                If the model is unavailable, the same rule-based guidance is shown and labelled as such.
              </li>
            </ol>
          </div>

          <ClinicalDisclaimer className="mt-6" />
        </section>
      </div>
    </AppShell>
  );
}
