import Link from 'next/link';
import { AppShell } from './AppShell';
import { EmptyState, PageHeader } from './ui/Layout';

export function PatientScopeEmpty({ title = 'Choose a patient first' }: { title?: string }) {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Patient record"
        title={title}
        description="This screen works on one patient record at a time. Open the patient panel, choose a patient, then continue from there."
      />
      <div className="mt-8">
        <EmptyState
          title="No patient selected"
          description="Clinician and administrator sessions must name the patient explicitly. Nothing is loaded until then."
          action={
            <Link href="/doctor-portal" className="btn-primary">
              Open the patient panel
            </Link>
          }
        />
      </div>
    </AppShell>
  );
}
