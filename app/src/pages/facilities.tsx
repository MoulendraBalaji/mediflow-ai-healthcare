import Head from 'next/head';
import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Alert, ClinicalDisclaimer } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { EmptyState, PageHeader, SectionHeading, Skeleton } from '../components/ui/Layout';
import { api, errorMessage } from '../lib/api';
import type { FacilitySummary } from '../lib/types';

const TYPES = ['All', 'Hospital', 'Clinic', 'Laboratory', 'Urgent Care'];

function FacilityCard({ facility }: { facility: FacilitySummary }) {
  return (
    <li className="border border-rule bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
            {facility.facilityType}
          </p>
          <h3 className="mt-1 font-display text-xl leading-tight text-ink">{facility.name}</h3>
        </div>
        <span className="tag-neutral">{facility.providerCount} clinicians</span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{facility.address}</p>

      <dl className="mt-3 space-y-1.5 text-sm">
        {facility.contactNumber ? (
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
              Phone
            </dt>
            <dd className="text-ink-soft">{facility.contactNumber}</dd>
          </div>
        ) : null}
        {facility.email ? (
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
              Email
            </dt>
            <dd className="break-all text-ink-soft">{facility.email}</dd>
          </div>
        ) : null}
      </dl>

      {facility.specialties.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {facility.specialties.map((specialty) => (
            <li key={specialty}>
              <span className="tag-neutral">{specialty}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {facility.providers.length > 0 ? (
        <details className="mt-4 border-t border-rule pt-3">
          <summary className="cursor-pointer font-mono text-2xs uppercase tracking-[0.1em] text-ink-soft hover:text-ink">
            Clinicians at this facility ({facility.providers.length})
          </summary>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
            {facility.providers.map((provider) => (
              <li key={provider.id} className="flex flex-wrap gap-x-2">
                <span className="font-semibold text-ink">
                  Dr. {provider.firstName} {provider.lastName}
                </span>
                <span className="text-ink-faint">· {provider.specialty}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

export default function FacilitiesPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('All');
  const deferredSearch = useDeferredValue(search);

  const facilitiesQuery = useQuery({
    queryKey: ['facilities', { search: deferredSearch, type }],
    queryFn: () =>
      api.facilities.list({
        ...(deferredSearch.trim() ? { search: deferredSearch.trim() } : {}),
        ...(type !== 'All' ? { type } : {}),
      }),
    staleTime: 60_000,
  });

  const emergencyQuery = useQuery({
    queryKey: ['facilities', 'emergency'],
    queryFn: () => api.facilities.emergency(),
    staleTime: 5 * 60_000,
  });

  const facilities = facilitiesQuery.data?.facilities ?? [];
  const emergency = emergencyQuery.data?.facilities ?? [];

  return (
    <AppShell>
      <Head>
        <title>Facilities · MediFlow</title>
      </Head>

      <PageHeader
        eyebrow="Facilities"
        title="Know where to go."
        description="Hospitals, clinics, laboratories and urgent care from the clinic directory. MediFlow does not collect your location, so this is a directory — not a distance ranking."
        meta={
          <>
            <span className="tag-neutral">{facilities.length} in view</span>
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
              No geolocation collected
            </span>
          </>
        }
      />

      <section className="mt-8 border-l-2 border-y border-r border-crimson bg-crimson-light px-5 py-5" aria-labelledby="emergency-heading">
        <p className="font-mono text-2xs uppercase tracking-[0.12em] text-crimson">
          Life-threatening symptoms
        </p>
        <h2 id="emergency-heading" className="mt-1 font-display text-2xl leading-tight text-ink">
          Call your local emergency number first.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
          For chest pain, difficulty breathing, fainting, one-sided weakness, heavy bleeding or a seizure,
          do not wait for a directory. Call emergency services, or ask someone to take you to the nearest
          emergency department. Do not drive yourself.
        </p>
      </section>

      {emergencyQuery.isLoading ? null : emergency.length > 0 ? (
        <section className="mt-8" aria-labelledby="emergency-list-heading">
          <SectionHeading
            number="01"
            id="emergency-list-heading"
            title="Emergency and urgent care"
            description="Listed because the facility type or name indicates emergency or urgent care. Call ahead if you can."
          />
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {emergency.map((facility) => (
              <FacilityCard key={facility.id} facility={facility} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="directory-heading">
        <SectionHeading
          number={emergency.length > 0 ? '02' : '01'}
          id="directory-heading"
          title="The directory"
          description="Search by name, address or facility type. Results are listed alphabetically, not by distance."
        />

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <TextField
            label="Search facilities"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, address or type"
            maxLength={120}
          />
          <div>
            <p className="field-label">Facility type</p>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Facility type">
              {TYPES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={type === option}
                  onClick={() => setType(option)}
                  className={
                    type === option
                      ? 'border border-ink bg-ink px-3 py-2 font-mono text-2xs uppercase tracking-[0.08em] text-paper'
                      : 'border border-rule bg-surface px-3 py-2 font-mono text-2xs uppercase tracking-[0.08em] text-ink-soft hover:border-ink'
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          {facilitiesQuery.isError ? (
            <Alert tone="danger" title="Could not load the directory">
              {errorMessage(facilitiesQuery.error)}
            </Alert>
          ) : facilitiesQuery.isLoading ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <li key={index}>
                  <Skeleton className="h-44 w-full" />
                </li>
              ))}
            </ul>
          ) : facilities.length === 0 ? (
            <EmptyState
              title="No facilities match"
              description="Try a broader search or choose a different facility type. The directory only lists facilities that have been added to MediFlow."
              action={
                search || type !== 'All' ? (
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setSearch('');
                      setType('All');
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {facilities.map((facility) => (
                <FacilityCard key={facility.id} facility={facility} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <ClinicalDisclaimer className="mt-12" />
    </AppShell>
  );
}
