import Head from 'next/head';
import Link from 'next/link';
import { PublicLayout } from '../components/PublicLayout';
import { Alert } from '../components/ui/Alert';

const SECTIONS = [
  {
    id: 'demo',
    title: 'A demonstration, not a clinical service',
    body: [
      'MediFlow is a hackathon build. It is provided to demonstrate how clinical documents can be extracted, reviewed, ordered and explained. It is not a medical device, a clinical decision-support system, a prescribing system or a substitute for professional care.',
      'Do not rely on it as the only copy of a medical record. Keep the original documents and follow the instructions of your clinician.',
    ],
  },
  {
    id: 'emergency',
    title: 'Emergencies',
    body: [
      'MediFlow is not an emergency service and does not monitor messages. If you think you may be in immediate danger, call your local emergency number now. Do not wait for a response from this product.',
      'The navigator can identify phrases that need emergency care, but a rule set cannot recognise every emergency. Absence of a red flag is not reassurance.',
    ],
  },
  {
    id: 'advice',
    title: 'No medical advice',
    body: [
      'Explanations, summaries, reminders and navigation are informational. They are not a diagnosis, a prescription, a dose change or a treatment plan. MediFlow never asks you to stop, start or change a medicine.',
      'Always confirm instructions with the printed label, your pharmacist, your prescriber or another qualified professional.',
    ],
  },
  {
    id: 'accuracy',
    title: 'Accuracy and review',
    body: [
      'Document extraction can be wrong, especially with poor scans, handwriting or unusual layouts. Every extracted field is shown for review before it is saved. You are responsible for correcting anything that is wrong before saving it.',
      'The timeline, duplicate check and interaction flags use a short, explicit rule set. They are prompts to ask a professional, not a complete clinical review.',
    ],
  },
  {
    id: 'ai',
    title: 'AI-assisted output',
    body: [
      'When an AI provider is configured, a model may help extract text, summarise recorded care or rewrite an explanation. Deterministic rules set urgency and recommendations, and model output is not permitted to invent clinical facts.',
      'AI services can be unavailable. In that case the product says so, or shows rule-based output with a clear label. It does not silently replace a failure with invented content.',
    ],
  },
  {
    id: 'accounts',
    title: 'Your account and access',
    body: [
      'Keep your password private. Sign out on shared devices. Self-registration creates a patient account only; clinician and administrator accounts are provisioned separately.',
      'You must not attempt to access another person’s record, probe the API for identifiers, or use the product to harass, discriminate or provide care to someone without authority. Access checks return “not found” for records you may not see.',
    ],
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    body: [
      'The service may be changed, suspended or reset without notice. Features described on this site may be incomplete. There is no service-level agreement and no guarantee that data will be retained.',
      'These terms may change with the build. The “last updated” date below will change when they do.',
    ],
  },
  {
    id: 'liability',
    title: 'Liability',
    body: [
      'To the extent permitted by law, this build is provided “as is”, without warranties of any kind. The team that built the demonstration is not liable for decisions made in reliance on it.',
      'Nothing in these terms limits rights that cannot lawfully be limited. A production deployment needs terms reviewed for its own jurisdiction and operator.',
    ],
  },
];

export default function TermsPage() {
  return (
    <PublicLayout>
      <Head>
        <title>Terms of use · MediFlow</title>
      </Head>

      <div className="shell py-12 sm:py-16">
        <p className="eyebrow">Trust</p>
        <h1 className="display-sm mt-3 max-w-3xl">Terms of use</h1>
        <p className="lede mt-4 max-w-2xl text-base">
          The rules for using this demonstration build — in plain language, with the limits stated
          directly.
        </p>
        <p className="mt-3 font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint">
          Last updated 26 October 2026
        </p>

        <Alert tone="warning" title="Not legal advice" className="mt-8 max-w-3xl">
          This page is a plain-language summary for a hackathon build, not a lawyer-reviewed contract. A
          production deployment needs terms prepared for its operator and jurisdiction.
        </Alert>

        <div className="mt-12 grid gap-12 lg:grid-cols-[0.32fr_0.68fr] lg:gap-16">
          <nav aria-label="On this page" className="lg:sticky lg:top-8 lg:self-start">
            <p className="eyebrow">On this page</p>
            <ol className="mt-3 space-y-2 border-l border-rule pl-4">
              {SECTIONS.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-sm text-ink-soft hover:text-ink">
                    <span className="mr-2 font-mono text-2xs text-ink-faint">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-10">
            {SECTIONS.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <p className="eyebrow">{String(index + 1).padStart(2, '0')}</p>
                <h2 className="mt-1 font-display text-2xl text-ink">{section.title}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="prose-editorial mt-3 text-base">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}

            <div className="border-t border-rule pt-6">
              <p className="text-sm leading-relaxed text-ink-soft">
                Read the <Link href="/privacy" className="btn-link text-sm">privacy notice</Link> or return to
                the <Link href="/" className="btn-link text-sm">overview</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
