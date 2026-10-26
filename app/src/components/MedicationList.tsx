import type { Medication } from '../lib/types';
import { formatDate } from '../lib/format';
import { EmptyState } from './ui/Layout';

export function MedicationList({
  medications,
  emptyTitle = 'No medicines recorded',
  emptyDescription = 'Medicines appear here when a prescription is extracted and saved.',
}: {
  medications: Medication[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (medications.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto border-y border-rule">
      <table className="w-full min-w-[36rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-rule">
            {['Medicine', 'Dose', 'Directions', 'Recorded for', 'Started'].map((heading) => (
              <th
                key={heading}
                scope="col"
                className="py-2.5 pr-4 font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {medications.map((medication) => (
            <tr key={medication.id} className="border-b border-rule align-top last:border-b-0">
              <th scope="row" className="py-3.5 pr-4 text-sm font-semibold text-ink">
                {medication.name}
              </th>
              <td className="py-3.5 pr-4 text-sm text-ink-soft">{medication.dosage || '—'}</td>
              <td className="py-3.5 pr-4 text-sm text-ink-soft">{medication.frequency || '—'}</td>
              <td className="py-3.5 pr-4 text-sm text-ink-soft">{medication.indication || 'Not recorded'}</td>
              <td className="py-3.5 pr-4 text-sm text-ink-soft">{formatDate(medication.startDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
