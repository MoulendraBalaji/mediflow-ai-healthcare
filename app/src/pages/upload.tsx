import Head from 'next/head';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState, type DragEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { PatientScopeEmpty } from '../components/PatientScopeEmpty';
import { Alert, ClinicalDisclaimer } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { EmptyState, PageHeader, SectionHeading } from '../components/ui/Layout';
import { api, errorMessage, isApiError } from '../lib/api';
import { formatDate, recordTypeLabel, todayInput } from '../lib/format';
import type { ExtractedMedication, ExtractionResult, RecordType } from '../lib/types';
import { usePatientScope } from '../lib/usePatientScope';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain';

const RECORD_TYPES: RecordType[] = [
  'PRESCRIPTION',
  'LAB_REPORT',
  'DISCHARGE_SUMMARY',
  'IMAGING',
  'ENCOUNTER',
  'OTHER',
];

interface MedicationDraft extends ExtractedMedication {}

interface ReviewState {
  recordType: RecordType;
  recordDate: string;
  description: string;
  facilityId: string;
  providerId: string;
  allergies: string;
  diagnoses: string;
  medications: MedicationDraft[];
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function confidenceTone(value: number): 'pine' | 'ochre' | 'clay' {
  if (value >= 0.75) return 'pine';
  if (value >= 0.5) return 'ochre';
  return 'clay';
}

function ConfidenceRow({ label, value }: { label: string; value: number }) {
  const tone = confidenceTone(value);
  const bar = { pine: 'bg-pine', ochre: 'bg-ochre', clay: 'bg-clay' }[tone];
  const text = { pine: 'text-pine', ochre: 'text-ochre', clay: 'text-clay' }[tone];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">{label}</span>
        <span className={`font-mono text-2xs ${text}`}>{Math.round(value * 100)}%</span>
      </div>
      <div className="mt-1 h-1 w-full bg-rule" role="presentation">
        <div className={`h-1 ${bar}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

export default function UploadPage() {
  const { patientId, isStaff } = usePatientScope();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [recordType, setRecordType] = useState<RecordType>('PRESCRIPTION');
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const facilities = useQuery({
    queryKey: ['facilities', 'upload'],
    queryFn: () => api.facilities.list(),
    staleTime: 60_000,
  });

  const providers = useQuery({
    queryKey: ['providers', 'upload'],
    queryFn: () => api.providers.list(),
    staleTime: 60_000,
  });

  const extract = useMutation({
    mutationFn: ({ selected, type }: { selected: File; type: RecordType }) =>
      api.records.extract(selected, { patientId: patientId ?? undefined, recordType: type }),
    onSuccess: (result) => {
      setSavedId(null);
      setExtraction(result.extraction);
      const data = result.extraction.data;
      setReview({
        recordType: result.extraction.recordType,
        recordDate: result.extraction.recordDate || todayInput(),
        description: data?.diagnoses.length
          ? `${recordTypeLabel(result.extraction.recordType)} — ${data.diagnoses.slice(0, 2).join(', ')}`
          : `${recordTypeLabel(result.extraction.recordType)} uploaded ${formatDate(result.extraction.recordDate)}`,
        facilityId: '',
        providerId: '',
        allergies: data?.allergies.join(', ') ?? '',
        diagnoses: data?.diagnoses.join(', ') ?? '',
        medications: data?.medications ?? [],
      });
    },
  });

  const save = useMutation({
    mutationFn: () => {
      if (!extraction || !review) throw new Error('Nothing to save');
      const cleanedMedications = review.medications
        .filter((medication) => medication.name.trim().length > 0)
        .map((medication) => ({
          name: medication.name.trim(),
          dosage: medication.dosage,
          frequency: medication.frequency,
          indication: medication.indication,
          prescribedBy: medication.prescribedBy,
          startDate: medication.startDate,
          endDate: medication.endDate,
        }));

      const extractedData = {
        ...(extraction.data ?? {}),
        allergies: splitList(review.allergies),
        diagnoses: splitList(review.diagnoses),
      };

      return api.records.create({
        patientId: patientId ?? undefined,
        providerId: review.providerId || null,
        facilityId: review.facilityId || undefined,
        recordType: review.recordType,
        recordDate: review.recordDate,
        description: review.description.trim(),
        fileName: extraction.fileName,
        extractedData,
        medications: cleanedMedications,
      });
    },
    onSuccess: (result) => {
      setSavedId(result.record.id);
      setExtraction(null);
      setReview(null);
      setFile(null);
    },
  });

  if (!patientId) return <PatientScopeEmpty />;

  const chooseFile = (candidate: File | undefined) => {
    setLocalError(null);
    setSavedId(null);
    extract.reset();
    if (!candidate) return;
    if (candidate.size > MAX_BYTES) {
      setLocalError('That file is larger than 10 MB. Please compress it or split it.');
      return;
    }
    const lower = candidate.name.toLowerCase();
    const accepted =
      lower.endsWith('.pdf') ||
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.txt') ||
      ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'].includes(candidate.type);
    if (!accepted) {
      setLocalError('Use a PDF, PNG, JPEG or plain-text file. Other formats can carry hidden content.');
      return;
    }
    setFile(candidate);
    setExtraction(null);
    setReview(null);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  };

  const updateMedication = (index: number, key: keyof MedicationDraft, value: string) => {
    setReview((current) => {
      if (!current) return current;
      const next = current.medications.map((medication, position) =>
        position === index ? { ...medication, [key]: value } : medication
      );
      return { ...current, medications: next };
    });
  };

  const addMedication = () => {
    setReview((current) =>
      current
        ? {
            ...current,
            medications: [
              ...current.medications,
              {
                name: '',
                dosage: '',
                frequency: '',
                indication: '',
                prescribedBy: '',
                startDate: '',
                endDate: '',
              },
            ],
          }
        : current
    );
  };

  const removeMedication = (index: number) => {
    setReview((current) =>
      current ? { ...current, medications: current.medications.filter((_, position) => position !== index) } : current
    );
  };

  const reset = () => {
    setFile(null);
    setExtraction(null);
    setReview(null);
    setLocalError(null);
    extract.reset();
    save.reset();
    if (inputRef.current) inputRef.current.value = '';
  };

  const extractionError = extract.error;
  const extractionErrorCode = isApiError(extractionError) ? extractionError.code : null;

  return (
    <AppShell>
      <Head>
        <title>Add a document · MediFlow</title>
      </Head>

      <PageHeader
        eyebrow="Intake"
        title="Add a document. Review every field."
        description="MediFlow reads the file, then shows you what it found before anything is saved. If a field cannot be read, it is left empty rather than guessed."
        meta={
          <>
            <span className="tag-neutral">PDF · PNG · JPEG · TXT</span>
            <span className="tag-neutral">Max 10 MB</span>
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
              One file at a time
            </span>
          </>
        }
      />

      {savedId ? (
        <Alert tone="success" title="Saved to the record" className="mt-6">
          The reviewed document is now part of this patient’s record.{' '}
          <Link href={isStaff ? `/timeline?patientId=${patientId}` : '/timeline'} className="btn-link text-sm">
            Open the timeline
          </Link>{' '}
          or{' '}
          <button type="button" onClick={reset} className="btn-link text-sm">
            add another document
          </button>
          .
        </Alert>
      ) : null}

      {localError ? (
        <Alert tone="danger" title="That file cannot be used" className="mt-6">
          {localError}
        </Alert>
      ) : null}

      {extractionError ? (
        <Alert tone="danger" title="Extraction did not complete" className="mt-6">
          <p>{errorMessage(extractionError)}</p>
          <p className="mt-2 text-xs text-ink-faint">
            Nothing was saved and no clinical values were invented. You can try a sharper photo, a
            text-based PDF, or enter the document manually with your clinic.
            {extractionErrorCode === 'EXTRACTION_UNAVAILABLE'
              ? ' The document reader is currently unavailable; this is an infrastructure limit, not a reading of your file.'
              : ''}
          </p>
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        {/* Upload panel */}
        <section aria-labelledby="upload-heading">
          <SectionHeading
            number="01"
            id="upload-heading"
            title="Choose the file"
            description="The file type is checked from its contents, not just its name."
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <SelectField
              label="Document type"
              value={recordType}
              onChange={(event) => setRecordType(event.target.value as RecordType)}
              hint="Used to prompt the reader. It does not change what is extracted."
            >
              {RECORD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {recordTypeLabel(type)}
                </option>
              ))}
            </SelectField>
            <Button
              variant="primary"
              onClick={() => file && extract.mutate({ selected: file, type: recordType })}
              loading={extract.isPending}
              disabled={!file}
            >
              {extract.isPending ? 'Reading document' : 'Read document'}
            </Button>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`mt-5 border border-dashed p-8 text-center transition-colors ${
              dragging ? 'border-pine bg-pine-light' : 'border-rule-strong bg-surface'
            }`}
          >
            <p className="font-display text-xl text-ink">
              {file ? file.name : 'Drop a document here'}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              {file
                ? `${(file.size / 1024).toFixed(0)} KB selected. Nothing has been sent yet.`
                : 'A prescription, lab report, discharge summary or a clear photograph of one.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button type="button" className="btn-quiet" onClick={() => inputRef.current?.click()}>
                {file ? 'Choose a different file' : 'Browse files'}
              </button>
              {file ? (
                <Button variant="quiet" onClick={() => extract.mutate({ selected: file, type: recordType })}>
                  Send for reading
                </Button>
              ) : null}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
          </div>

          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            Files are processed in memory for extraction. The API does not write to the database until you
            review and save. Password-protected or damaged PDFs are rejected by name, not silently skipped.
          </p>
        </section>

        {/* Result panel */}
        <section aria-labelledby="result-heading">
          <SectionHeading
            number="02"
            id="result-heading"
            title="Review what was read"
            description="Every field below came from the document. Edit anything that is wrong before saving."
          />

          {!extraction && !extract.isPending ? (
            <div className="mt-5">
              <EmptyState
                title="Nothing read yet"
                description="Choose a file and select “Read document”. The extraction preview appears here."
              />
            </div>
          ) : null}

          {extract.isPending ? (
            <div className="mt-5 border border-rule bg-surface p-6">
              <p className="font-display text-xl text-ink">Reading the document…</p>
              <p className="mt-2 text-sm text-ink-soft">
                Text-based PDFs and plain text go through the document reader. Images go through the vision
                reader. A model is only used when a key is configured.
              </p>
            </div>
          ) : null}

          {extraction ? (
            <div className="mt-5 space-y-5">
              {extraction.demo ? (
                <Alert tone="warning" title="Demo mode — not your document">
                  {extraction.message ||
                    'This is sample data produced by DEMO_MODE. It is not a reading of the file you selected.'}
                </Alert>
              ) : null}

              {extraction.needsOcr ? (
                <Alert tone="warning" title="This document needs OCR">
                  <p>{extraction.message}</p>
                  <p className="mt-2 text-xs text-ink-faint">
                    No medicines, allergies or diagnoses have been created. Try a text-based PDF or a clear
                    photograph instead.
                  </p>
                </Alert>
              ) : null}

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-rule py-4">
                <div>
                  <dt className="data-key">File</dt>
                  <dd className="data-value break-all">{extraction.fileName}</dd>
                </div>
                <div>
                  <dt className="data-key">Reader</dt>
                  <dd className="data-value">{extraction.extractor}</dd>
                </div>
                <div>
                  <dt className="data-key">Document date</dt>
                  <dd className="data-value">{formatDate(extraction.recordDate)}</dd>
                </div>
                <div>
                  <dt className="data-key">Pages</dt>
                  <dd className="data-value">{extraction.pages ?? 'Not applicable'}</dd>
                </div>
                <div>
                  <dt className="data-key">Clinician on document</dt>
                  <dd className="data-value">{extraction.providerName || 'Not recorded'}</dd>
                </div>
                <div>
                  <dt className="data-key">Facility on document</dt>
                  <dd className="data-value">{extraction.facilityName || 'Not recorded'}</dd>
                </div>
              </dl>

              <div>
                <p className="eyebrow">Field confidence</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <ConfidenceRow label="Medicines" value={extraction.confidence.medications} />
                  <ConfidenceRow label="Allergies" value={extraction.confidence.allergies} />
                  <ConfidenceRow label="Diagnoses" value={extraction.confidence.diagnoses} />
                  <ConfidenceRow label="Encounters" value={extraction.confidence.encounters} />
                  <ConfidenceRow label="Notes" value={extraction.confidence.notes} />
                  <ConfidenceRow label="Overall" value={extraction.confidence.overall} />
                </div>
                <p className="mt-2 text-xs text-ink-faint">
                  Confidence is the reader’s own estimate of legibility, not a clinical certainty score.
                </p>
              </div>

              {extraction.status === 'ok' && review ? (
                <form
                  className="space-y-5 border-t border-ink pt-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    save.mutate();
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                      label="Record type"
                      value={review.recordType}
                      onChange={(event) =>
                        setReview({ ...review, recordType: event.target.value as RecordType })
                      }
                    >
                      {RECORD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {recordTypeLabel(type)}
                        </option>
                      ))}
                    </SelectField>
                    <TextField
                      label="Document date"
                      type="date"
                      required
                      value={review.recordDate}
                      onChange={(event) => setReview({ ...review, recordDate: event.target.value })}
                    />
                  </div>

                  <TextAreaField
                    label="Description"
                    required
                    minLength={2}
                    maxLength={2000}
                    value={review.description}
                    onChange={(event) => setReview({ ...review, description: event.target.value })}
                    hint="A short, factual description. Avoid adding a diagnosis that is not in the document."
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      label="Allergies on document"
                      value={review.allergies}
                      onChange={(event) => setReview({ ...review, allergies: event.target.value })}
                      hint="Comma-separated. Leave blank if none were printed."
                    />
                    <TextField
                      label="Diagnoses on document"
                      value={review.diagnoses}
                      onChange={(event) => setReview({ ...review, diagnoses: event.target.value })}
                      hint="Comma-separated. Do not add a diagnosis that is not written."
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                      label="Facility"
                      value={review.facilityId}
                      onChange={(event) => setReview({ ...review, facilityId: event.target.value })}
                      hint="Leave blank to match the printed name, or fall back to the default facility."
                    >
                      <option value="">Match from document / default</option>
                      {facilities.data?.facilities.map((facility) => (
                        <option key={facility.id} value={facility.id}>
                          {facility.name}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      label="Clinician"
                      value={review.providerId}
                      onChange={(event) => setReview({ ...review, providerId: event.target.value })}
                      hint="Leave blank to match the printed name, or use the signed-in clinician."
                    >
                      <option value="">Match from document</option>
                      {providers.data?.providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          Dr. {provider.firstName} {provider.lastName} · {provider.specialty}
                        </option>
                      ))}
                    </SelectField>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3 border-b border-rule pb-2">
                      <p className="eyebrow">Medicines</p>
                      <Button type="button" variant="quiet" onClick={addMedication}>
                        Add medicine
                      </Button>
                    </div>

                    {review.medications.length === 0 ? (
                      <p className="mt-3 text-sm text-ink-faint">
                        No medicines were extracted. You can add one if the document contains a prescription
                        that was missed, but only copy what is printed.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-4">
                        {review.medications.map((medication, index) => (
                          <fieldset key={index} className="border border-rule p-3">
                            <legend className="px-2 font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                              Medicine {index + 1}
                            </legend>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block">
                                <span className="field-label">Name</span>
                                <input
                                  className="field"
                                  value={medication.name}
                                  onChange={(event) => updateMedication(index, 'name', event.target.value)}
                                  placeholder="Exactly as printed"
                                />
                              </label>
                              <label className="block">
                                <span className="field-label">Dose</span>
                                <input
                                  className="field"
                                  value={medication.dosage ?? ''}
                                  onChange={(event) => updateMedication(index, 'dosage', event.target.value)}
                                  placeholder="e.g. 500 mg"
                                />
                              </label>
                              <label className="block">
                                <span className="field-label">Directions</span>
                                <input
                                  className="field"
                                  value={medication.frequency ?? ''}
                                  onChange={(event) => updateMedication(index, 'frequency', event.target.value)}
                                  placeholder="e.g. twice daily with meals"
                                />
                              </label>
                              <label className="block">
                                <span className="field-label">Recorded for</span>
                                <input
                                  className="field"
                                  value={medication.indication ?? ''}
                                  onChange={(event) => updateMedication(index, 'indication', event.target.value)}
                                  placeholder="Only if printed"
                                />
                              </label>
                            </div>
                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                className="text-xs font-semibold text-crimson underline decoration-rule-strong underline-offset-4 hover:decoration-crimson"
                                onClick={() => removeMedication(index)}
                              >
                                Remove this medicine
                              </button>
                            </div>
                          </fieldset>
                        ))}
                      </div>
                    )}
                  </div>

                  {save.isError ? (
                    <Alert tone="danger" title="Could not save">
                      {errorMessage(save.error)}
                    </Alert>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-5">
                    <Button type="submit" loading={save.isPending}>
                      {save.isPending ? 'Saving review' : 'Save to record'}
                    </Button>
                    <Button type="button" variant="quiet" onClick={reset}>
                      Discard and start over
                    </Button>
                    <p className="text-xs text-ink-faint">Saving writes the record and its medicines together.</p>
                  </div>
                </form>
              ) : null}

              <ClinicalDisclaimer />
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
