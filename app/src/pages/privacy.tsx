import Head from 'next/head';
import Link from 'next/link';
import { PublicLayout } from '../components/PublicLayout';
import { Alert } from '../components/ui/Alert';

const SECTIONS = [
  {
    id: 'scope',
    title: 'What this deployment is',
    body: [
      'MediFlow is a demonstration build created for the Product Space AI Agent Hackathon. It is not a production clinical service and it is not operated by a hospital unless a hospital has deployed it. For anything urgent, contact your local emergency number or your own clinic.',
      'This notice describes what this build actually does with data. It is written in plain language rather than as a lawyer-reviewed agreement.',
    ],
  },
  {
    id: 'collected',
    title: 'What is stored',
    body: [
      'Account details: your name, email address, date of birth, gender and optional contact number. A password is stored only as a one-way hash.',
      'Care records: documents you choose to save, the fields reviewed and confirmed on the upload screen, medicines, appointments, reminders and allergies or diagnoses that appear in a saved document.',
      'Agent activity: a short log of each agent run, including the input you supplied, the output produced, its status and duration. This is used to make the system explainable.',
      'Audit events: who viewed or changed what, and when. Audit entries record identifiers and actions, not the clinical content of a document.',
    ],
  },
  {
    id: 'uploads',
    title: 'What happens to an uploaded file',
    body: [
      'The file is read in memory so its contents can be checked and extracted. The extraction preview is not written to the database until you review it and choose to save.',
      'When you save, MediFlow stores the reviewed fields and the original filename. It does not retain the uploaded file bytes in this build, so the saved record is a structured summary rather than a copy of the document.',
      'A file that cannot be read is rejected or marked as needing OCR. MediFlow does not invent values to fill the gap.',
    ],
  },
  {
    id: 'ai',
    title: 'When a language model is used',
    body: [
      'If an AI provider key is configured, the text needed for a task may be sent to that provider to extract fields, summarise recorded care, explain a prescription or translate text. If no key is configured, or the provider is unavailable, the product falls back to explicit rules and labels the output as rule-based.',
      'Model output is not allowed to set an emergency urgency, change a recommendation or add a medicine, allergy or diagnosis that is not in the record. Those decisions come from deterministic rules or from what you confirmed on screen.',
      'The AI provider processes requests under its own terms. Do not assume that a third-party provider has the same retention policy as this deployment.',
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies and local storage',
    body: [
      'Sign-in uses two httpOnly cookies: mf_access (about 15 minutes) and mf_refresh (about 7 days). In production they are marked Secure and SameSite=Lax. They are not readable by page scripts.',
      'Access tokens are not copied into localStorage or sessionStorage. There are no advertising or analytics cookies, and MediFlow does not collect your location.',
    ],
  },
  {
    id: 'access',
    title: 'Who can see a record',
    body: [
      'A patient can see their own record. A clinician can see a patient only where a recorded access grant, appointment or signed document creates a care relationship. Administrators can see aggregate analytics and the patient data needed to operate the service.',
      'Every patient-scoped API request is checked. A request for a patient the caller may not see returns “not found” rather than confirming that the record exists.',
    ],
  },
  {
    id: 'retention',
    title: 'Retention and deletion',
    body: [
      'This build has no automatic retention schedule. Records remain until they are deleted through the record tools or the deployment is reset. Soft-deleted records are hidden from normal views but may remain in the database.',
      'Self-service account deletion and data export are not implemented. If you need either, contact the operator of this deployment.',
    ],
  },
  {
    id: 'contact',
    title: 'Questions and changes',
    body: [
      'Use the contact route published by the organisation hosting this deployment. There is no central MediFlow privacy inbox for this hackathon build.',
      'If this notice changes, the “last updated” date below will change with it. Material changes should be communicated by the deployment operator.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <Head>
        <title>Privacy notice · MediFlow</title>
      </Head>

      <div className="shell py-12 sm:py-16">
        <p className="eyebrow">Trust</p>
        <h1 className="display-sm mt-3 max-w-3xl">Privacy notice</h1>
        <p className="lede mt-4 max-w-2xl text-base">
          What this build stores, when a model is called, and how access to a patient record is checked.
        </p>
        <p className="mt-3 font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint">
          Last updated 26 October 2026
        </p>

        <Alert tone="warning" title="Demonstration build" className="mt-8 max-w-3xl">
          This is not a production clinical service and this notice is not legal advice. A real deployment
          needs a lawyer-reviewed privacy notice, a named data controller, a retention schedule and a
          documented breach process.
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
                Read the <Link href="/terms" className="btn-link text-sm">terms of use</Link> or return to the{' '}
                <Link href="/" className="btn-link text-sm">overview</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
