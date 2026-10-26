import Head from 'next/head';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { Alert, ClinicalDisclaimer, ModeNote } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { SelectField, TextAreaField } from '../components/ui/Field';
import { EmptyState, PageHeader, SectionHeading } from '../components/ui/Layout';
import { api, errorMessage } from '../lib/api';
import type { ExplanationResult, TranslationResult } from '../lib/types';
import { usePatientScope } from '../lib/usePatientScope';

type Mode = 'explain' | 'translate';

const MODES: Array<{ value: Mode; label: string; description: string }> = [
  {
    value: 'explain',
    label: 'Explain a prescription',
    description: 'Plain-language explanation of what is written and what to ask a pharmacist about.',
  },
  {
    value: 'translate',
    label: 'Translate',
    description: 'Translate the text while keeping medicine names, doses and warnings intact.',
  },
];

const EXPLAIN_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'Hindi',
  'Tamil',
  'Arabic',
  'Portuguese',
  'Simplified Chinese',
];

const TRANSLATE_LANGUAGES = [
  'Spanish',
  'French',
  'Hindi',
  'Tamil',
  'Arabic',
  'Portuguese',
  'Simplified Chinese',
  'English',
];

type RunVariables = { mode: Mode; text: string; language: string };
type RunResult = ExplanationResult | TranslationResult;

export default function TranslatePage() {
  const { patientId } = usePatientScope();
  const [mode, setMode] = useState<Mode>('explain');
  const [text, setText] = useState('');
  const [explainLanguage, setExplainLanguage] = useState('English');
  const [translateLanguage, setTranslateLanguage] = useState('Spanish');
  const [localError, setLocalError] = useState<string | null>(null);

  const run = useMutation<RunResult, unknown, RunVariables>({
    mutationFn: (variables) => {
      const scopedPatientId = patientId ?? undefined;
      if (variables.mode === 'explain') {
        return api.providers.explain(variables.text, variables.language, scopedPatientId);
      }
      return api.providers.translate(variables.text, variables.language, scopedPatientId);
    },
  });

  const language = mode === 'explain' ? explainLanguage : translateLanguage;
  const result = run.data;
  const resultMode = result && run.variables?.mode === mode ? mode : null;
  const explanation = resultMode === 'explain' && result && 'explanation' in result ? result : null;
  const translation = resultMode === 'translate' && result && 'translated' in result ? result : null;

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setLocalError(null);
    run.reset();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    if (text.trim().length === 0) {
      setLocalError('Paste the prescription text or directions you want explained.');
      return;
    }
    if (text.length > 8000) {
      setLocalError('Keep the text under 8,000 characters. Split a very long document.');
      return;
    }
    run.mutate({ mode, text: text.trim(), language });
  };

  return (
    <AppShell>
      <Head>
        <title>Explain a prescription · MediFlow</title>
      </Head>

      <PageHeader
        eyebrow="Explain"
        title="Read the label with confidence."
        description="Paste what is printed. MediFlow can explain it in plain language or translate it without changing a medicine name, a dose or a warning. It will not tell you to take something different."
        meta={
          <>
            <span className="tag-neutral">Nothing is saved to the chart</span>
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
              AI-assisted · unavailable results are labelled
            </span>
          </>
        }
      />

      <div className="mt-8 grid grid-cols-1 gap-1 border border-rule bg-rule sm:grid-cols-2">
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            onClick={() => switchMode(option.value)}
            className={
              mode === option.value
                ? 'bg-surface px-5 py-4 text-left'
                : 'bg-paper px-5 py-4 text-left hover:bg-surface'
            }
          >
            <span className="font-display text-xl text-ink">{option.label}</span>
            <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{option.description}</span>
          </button>
        ))}
      </div>

      {localError ? (
        <Alert tone="warning" title="Check the text" className="mt-6">
          {localError}
        </Alert>
      ) : null}

      {run.isError ? (
        <Alert tone="danger" title="The request did not complete" className="mt-6">
          {errorMessage(run.error)}
        </Alert>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
        <section aria-labelledby="input-heading">
          <SectionHeading
            number="01"
            id="input-heading"
            title="What does it say?"
            description="Copy the printed directions exactly. Do not add a dose or a diagnosis that is not on the label."
          />

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <TextAreaField
              label={mode === 'explain' ? 'Prescription text or directions' : 'Text to translate'}
              required
              rows={8}
              maxLength={8000}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                mode === 'explain'
                  ? 'e.g. Metformin 500 mg — take one tablet twice daily with meals. Return if you have persistent nausea.'
                  : 'Paste the directions exactly as printed.'
              }
              hint={`${text.length.toLocaleString()} / 8,000 characters`}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label={mode === 'explain' ? 'Explanation language' : 'Translate into'}
                value={language}
                onChange={(event) =>
                  mode === 'explain'
                    ? setExplainLanguage(event.target.value)
                    : setTranslateLanguage(event.target.value)
                }
              >
                {(mode === 'explain' ? EXPLAIN_LANGUAGES : TRANSLATE_LANGUAGES).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectField>
              <div className="flex items-end">
                <Button type="submit" loading={run.isPending} className="w-full">
                  {run.isPending
                    ? mode === 'explain'
                      ? 'Explaining'
                      : 'Translating'
                    : mode === 'explain'
                      ? 'Explain this text'
                      : 'Translate this text'}
                </Button>
              </div>
            </div>

            <p className="border-t border-rule pt-4 text-xs leading-relaxed text-ink-faint">
              The text is sent to the configured AI provider only when you press the button. It is not
              written to the medical record. If no AI key is configured, or the service is down, the result
              says so and the original text is left unchanged.
            </p>
          </form>
        </section>

        <section aria-labelledby="output-heading">
          <SectionHeading
            number="02"
            id="output-heading"
            title="The explanation"
            description="The original stays visible so you can check every medicine and number."
          />

          <div className="mt-5">
            {run.isPending ? (
              <div className="border border-rule bg-surface p-6">
                <p className="font-display text-xl text-ink">
                  {mode === 'explain' ? 'Writing a plain-language explanation…' : 'Translating the text…'}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Medicine names, doses and warnings are preserved. Nothing is added to the record.
                </p>
              </div>
            ) : !result || !resultMode ? (
              <EmptyState
                title="Nothing to read yet"
                description="Paste the printed text and choose a language. The explanation or translation appears here, alongside the original."
              />
            ) : (
              <div className="space-y-5">
                <div className="border border-rule bg-paper p-5">
                  <p className="eyebrow">Original text</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
                    {result.original}
                  </p>
                </div>

                {explanation ? (
                  <>
                    {!explanation.available ? (
                      <Alert tone="warning" title="AI unavailable">
                        {explanation.message ??
                          'No explanation was generated. Read the printed label exactly as written and ask a pharmacist about anything that is unclear.'}
                      </Alert>
                    ) : null}
                    <div className="border border-rule bg-surface p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="eyebrow">Explanation · {explanation.language}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {explanation.cached ? <span className="tag-neutral">cached</span> : null}
                          <ModeNote mode={explanation.mode} />
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-[1.0625rem] leading-[1.75] text-ink-soft">
                        {explanation.explanation}
                      </p>
                    </div>
                  </>
                ) : null}

                {translation ? (
                  <>
                    {!translation.available ? (
                      <Alert tone="warning" title="Translation unavailable">
                        {translation.message ??
                          'Translation is unavailable right now. The original text has been left unchanged and nothing was invented.'}
                      </Alert>
                    ) : null}
                    <div className="border border-rule bg-surface p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="eyebrow">Translation · {translation.language}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {translation.cached ? <span className="tag-neutral">cached</span> : null}
                          <ModeNote mode={translation.mode} />
                        </div>
                      </div>
                      {translation.translated ? (
                        <p className="mt-3 whitespace-pre-wrap break-words text-[1.0625rem] leading-[1.75] text-ink-soft">
                          {translation.translated}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm leading-relaxed text-ink-faint">
                          No translated text was produced.
                        </p>
                      )}
                    </div>
                  </>
                ) : null}

                <div className="border-t border-rule pt-4 text-xs leading-relaxed text-ink-faint">
                  <p>
                    An explanation is not a prescription. Do not change how you take a medicine based on
                    this screen — confirm with the printed label, your pharmacist or your prescriber.
                  </p>
                  <p className="mt-2">
                    Cached results reuse an identical earlier request. The label shows when that happened.
                  </p>
                </div>
              </div>
            )}
          </div>

          <ClinicalDisclaimer className="mt-8" />
        </section>
      </div>
    </AppShell>
  );
}
