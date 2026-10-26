import Head from 'next/head';
import Link from 'next/link';
import { PublicLayout } from '../components/PublicLayout';
import { useAuth } from '../lib/auth';

const AGENTS = [
  {
    number: '01',
    name: 'Intake',
    line: 'Reads prescriptions, lab reports, discharge notes and photographs — and extracts only what is printed.',
    detail: 'Rejects unreadable scans instead of guessing. Flags when OCR is needed.',
  },
  {
    number: '02',
    name: 'Timeline',
    line: 'Puts every documented contact in order and looks for long gaps, duplicate courses and rule-based interactions.',
    detail: 'Deterministic checks, so the same records always produce the same review.',
  },
  {
    number: '03',
    name: 'Navigator',
    line: 'Turns symptoms into a sensible next step: which specialty, how soon, and where to go.',
    detail: 'Red-flag phrases trigger emergency guidance before any model is called.',
  },
  {
    number: '04',
    name: 'Companion',
    line: 'Builds reminders from the recorded plan and explains medicines in plain language.',
    detail: 'It never claims you took a dose. The care-engagement score is based on visits and the plan on file.',
  },
  {
    number: '05',
    name: 'Insight',
    line: 'Summarises recorded care for you — and operational patterns for care teams.',
    detail: 'Aggregates only. No new diagnosis, no invented test result.',
  },
];

const SAFETY = [
  {
    title: 'Nothing is invented',
    body: 'If a document cannot be read, MediFlow says so. If the AI layer is unavailable, the screen says that instead of filling the gap.',
  },
  {
    title: 'Emergency first',
    body: 'Chest pain, difficulty breathing, stroke signs and other red flags are triaged by fixed rules before a language model is involved.',
  },
  {
    title: 'Your record, your access',
    body: 'Every patient-scoped request is checked. A clinician only sees a patient through a recorded care relationship — anything else returns not found.',
  },
  {
    title: 'A labelled fallback',
    body: 'Without an API key, outputs are marked rule-based. With a key, only the wording is assisted; the clinical facts still come from your records.',
  },
];

export default function LandingPage() {
  const { user, status } = useAuth();
  const primaryHref = status === 'authenticated' ? (user?.role === 'ADMIN' ? '/admin' : user?.role === 'DOCTOR' ? '/doctor-portal' : '/dashboard') : '/register';
  const primaryLabel = status === 'authenticated' ? 'Open your workspace' : 'Create a patient account';

  return (
    <PublicLayout>
      <Head>
        <title>MediFlow — your care, in order</title>
      </Head>

      {/* Hero */}
      <section className="border-b border-rule">
        <div className="shell grid gap-12 py-14 lg:grid-cols-[1.45fr_0.85fr] lg:gap-16 lg:py-20">
          <div className="flex flex-col justify-center">
            <p className="eyebrow">Product Space AI Agent Hackathon · Clinical editorial</p>
            <h1 className="mt-5 font-display text-display font-medium text-ink">
              Your care,
              <br />
              in order.
            </h1>
            <p className="lede mt-6 max-w-2xl text-pretty">
              MediFlow reads the paperwork, rebuilds the chronology and turns it into a record you can
              actually use — with a clear next step when something needs attention.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={primaryHref} className="btn-primary">
                {primaryLabel}
              </Link>
              <Link href="/login" className="btn-secondary">
                Sign in
              </Link>
            </div>
            <dl className="mt-10 grid max-w-xl grid-cols-2 gap-x-8 gap-y-4 border-t border-rule pt-5 sm:grid-cols-4">
              {[
                ['5', 'agents'],
                ['PDF', 'photo · text'],
                ['0', 'invented facts'],
                ['404', 'on unauthorised access'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="font-display text-2xl font-medium text-ink">{value}</dt>
                  <dd className="mt-1 font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <aside className="border border-rule bg-surface p-6 sm:p-7">
            <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
              <p className="eyebrow">Structure preview</p>
              <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">Not patient data</p>
            </div>

            <div className="mt-5 space-y-6">
              <div>
                <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">Documents</p>
                <div className="mt-2 space-y-2">
                  <div className="h-2 w-full bg-rule/70" />
                  <div className="h-2 w-11/12 bg-rule/70" />
                  <div className="h-2 w-3/5 bg-rule/70" />
                </div>
                <p className="mt-2 text-xs text-ink-soft">Prescription · lab report · discharge summary</p>
              </div>
              <div>
                <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">Timeline</p>
                <ol className="mt-2 space-y-2 border-l border-rule-strong pl-4">
                  {['Documented contact', 'Care gap check', 'Duplicate course check'].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-xs text-ink-soft">
                      <span className="h-1.5 w-1.5 shrink-0 bg-pine" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">Medicines</p>
                <div className="mt-2 border border-rule p-3">
                  <div className="h-2 w-1/2 bg-rule/70" />
                  <div className="mt-2 h-2 w-2/3 bg-rule/70" />
                  <p className="mt-3 text-xs text-ink-faint">Dose and directions exactly as printed</p>
                </div>
              </div>
            </div>

            <p className="mt-6 border-t border-rule pt-4 text-xs leading-relaxed text-ink-faint">
              This panel shows the shape of a MediFlow record. It contains no clinical values and is not a
              sample patient.
            </p>
          </aside>
        </div>
      </section>

      {/* Problem */}
      <section className="border-b border-rule" id="how">
        <div className="shell py-14 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="eyebrow">The problem</p>
              <h2 className="display-sm mt-3 max-w-md">Care gets lost between the visits.</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                ['Fragmented', 'Records live in portals, PDFs, photographs and paper. No single chronology.'],
                ['Hard to read', 'Doses, follow-ups and warnings are buried in clinical shorthand.'],
                ['Easy to miss', 'A long gap or a duplicate course is invisible unless someone looks for it.'],
              ].map(([title, body]) => (
                <div key={title} className="border-t border-ink pt-3">
                  <h3 className="font-display text-xl text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="border-b border-rule bg-surface">
        <div className="shell py-14 sm:py-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">The workflow</p>
              <h2 className="display-sm mt-3">From a messy folder to a working record.</h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
              Four steps, each one reviewable. Nothing is saved until you have seen what was extracted.
            </p>
          </div>

          <ol className="mt-10 grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['01', 'Upload', 'A PDF, photograph or text file. Type is checked by magic bytes, not just the extension.'],
              ['02', 'Review', 'Every medicine, allergy and date is shown with a confidence signal. Edit anything before saving.'],
              ['03', 'Understand', 'The timeline, reminders and navigator work from the saved record — not from a guess.'],
              ['04', 'Act', 'Book a sensible next step, print what you need, or bring the summary to a clinician.'],
            ].map(([number, title, body]) => (
              <li key={number} className="bg-surface p-6">
                <p className="font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint">{number}</p>
                <h3 className="mt-3 font-display text-xl text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Agents */}
      <section className="border-b border-rule" id="agents">
        <div className="shell py-14 sm:py-16">
          <div className="max-w-2xl">
            <p className="eyebrow">Five agents, one record</p>
            <h2 className="display-sm mt-3">Specialised work, not one chatbot doing everything.</h2>
            <p className="lede mt-4 text-base">
              Each agent owns a narrow job. The one allowed to write prose is never allowed to change a
              clinical fact, an urgency level or a recommendation.
            </p>
          </div>

          <div className="mt-10 border-t border-ink">
            {AGENTS.map((agent) => (
              <article
                key={agent.number}
                className="grid gap-3 border-b border-rule py-6 sm:grid-cols-[3rem_10rem_1fr] sm:gap-6 lg:grid-cols-[3rem_12rem_1fr_1fr]"
              >
                <p className="font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint">{agent.number}</p>
                <h3 className="font-display text-2xl text-ink">{agent.name}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{agent.line}</p>
                <p className="border-l border-rule pl-4 text-xs leading-relaxed text-ink-faint sm:col-start-3 lg:col-start-4">
                  {agent.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Safety */}
      <section className="border-b border-rule bg-ink text-paper" id="safety">
        <div className="shell py-14 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="font-mono text-2xs uppercase tracking-[0.16em] text-paper/60">Safety posture</p>
              <h2 className="mt-3 font-display text-display-sm font-medium text-paper">
                Health software has to be honest.
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-paper/70">
                These are product rules, not marketing claims. The acceptance tests check them.
              </p>
            </div>
            <div className="grid gap-px bg-paper/20 sm:grid-cols-2">
              {SAFETY.map((item) => (
                <div key={item.title} className="bg-ink p-6">
                  <h3 className="font-display text-xl text-paper">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-paper/70">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="shell flex flex-col items-start justify-between gap-6 py-14 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Start with one document</p>
            <h2 className="display-sm mt-3 max-w-xl">Bring the folder. Leave with a record.</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={primaryHref} className="btn-primary">
              {primaryLabel}
            </Link>
            <Link href="/login" className="btn-quiet">
              I already have an account
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
