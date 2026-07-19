import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../components/Layout';
import { api } from '../lib/api';

interface MedicalRecord {
  id: string;
  recordType: string;
  recordDate: string;
  description: string;
  fileName?: string;
  provider?: { firstName: string; lastName: string; specialty?: string };
  facility?: { name: string };
  medications?: Array<{ name: string; dosage?: string; frequency?: string }>;
  flags?: { isDuplicate?: boolean; hasConflict?: boolean; isInGap?: boolean };
  extractedData?: any;
}

interface TimelineGap {
  type: string;
  date: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

interface DuplicateRecord {
  name: string;
  dates: string[];
  count: number;
}

interface DrugConflict {
  drug1: string;
  drug2: string;
  reason: string;
  severity: 'warning' | 'critical';
}

interface TimelineAnalysis {
  sortedEvents: Array<any>;
  gaps: TimelineGap[];
  duplicates: DuplicateRecord[];
  conflicts: DrugConflict[];
  narrativeSummary: string;
  statistics: {
    totalRecords: number;
    gapCount: number;
    duplicateCount: number;
    conflictCount: number;
  };
}

interface PatientData { id: string; firstName: string; lastName: string; }

export default function TimelinePage() {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [analysis, setAnalysis] = useState<TimelineAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const sessionResponse = await api.getSession();
        const user = sessionResponse.data.user;
        if (user.role !== 'PATIENT') { router.push('/login'); return; }

        const patientData = user.patient;
        setPatient(patientData);

        if (patientData.id) {
          const timelineResponse = await api.getTimelinePreview(patientData.id, 50);
          setRecords(timelineResponse.data.records || []);
          if (timelineResponse.data.analysis) {
            setAnalysis(timelineResponse.data.analysis);
          } else {
            await performAnalysis(patientData.id);
          }
        }
        setError(null);
      } catch (err: any) {
        setError(err.message);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const performAnalysis = async (patientId: string) => {
    try {
      setAnalyzing(true);
      const response = await api.analyzeTimeline(patientId);
      if (response.data?.data) setAnalysis(response.data.data);
    } catch (err: any) {
      console.error('Error analyzing timeline:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const getRecordIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      'Prescription': 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
      'Lab Report': 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
      'Discharge Summary': 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      'Imaging': 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      'Encounter': 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    };
    return iconMap[type] || 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
  };

  const isDuplicate = (record: MedicalRecord): boolean => {
    if (!analysis?.duplicates) return false;
    return analysis.duplicates.some((dup) => dup.name.toLowerCase() === record.recordType.toLowerCase());
  };

  const hasConflict = (record: MedicalRecord): boolean => {
    if (!analysis?.conflicts || !record.medications) return false;
    return analysis.conflicts.some((conf) =>
      record.medications!.some(
        (med) =>
          med.name.toLowerCase().includes(conf.drug1.toLowerCase()) ||
          med.name.toLowerCase().includes(conf.drug2.toLowerCase())
      )
    );
  };

  const isInGap = (record: MedicalRecord): boolean => {
    if (!analysis?.gaps) return false;
    const recordDate = new Date(record.recordDate);
    return analysis.gaps.some((gap) => {
      const gapDate = new Date(gap.date);
      return Math.abs(recordDate.getTime() - gapDate.getTime()) < 24 * 60 * 60 * 1000;
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-navy-500 font-medium">Loading timeline...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout patientName={patient ? `${patient.firstName} ${patient.lastName}` : ''} patientId={patient?.id}>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold text-navy-900 tracking-tight">Medical Timeline</h1>
            <p className="text-navy-500 mt-1">
              Complete chronological view of your medical history with AI-detected patterns and gaps.
            </p>
          </div>
          <button
            onClick={() => patient?.id && performAnalysis(patient.id)}
            disabled={analyzing}
            className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold hover:from-brand-700 hover:to-brand-800 transition-all duration-200 shadow-brand disabled:opacity-50 text-sm flex items-center gap-2"
          >
            {analyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-analyze
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="bg-red-50/80 backdrop-blur border border-red-200/50 rounded-xl p-4 animate-slide-down">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {records.length === 0 ? (
              <div className="card-blur p-12 text-center animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-navy-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-navy-600 font-medium">No medical records yet</p>
                <Link href="/upload" className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                  Upload your first document
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            ) : (
              records.map((record, index) => {
                const dup = isDuplicate(record);
                const conf = hasConflict(record);
                const gap = isInGap(record);

                return (
                  <div
                    key={record.id}
                    className="card-blur p-6 cursor-pointer animate-slide-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => setSelectedRecord(selectedRecord?.id === record.id ? null : record)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getRecordIcon(record.recordType)} />
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-navy-900">{record.recordType}</h3>
                          {dup && <span className="badge-danger">Duplicate</span>}
                          {conf && <span className="badge-warning">Conflict</span>}
                          {gap && <span className="badge bg-amber-100 text-amber-700">Missed Follow-up</span>}
                        </div>

                        <div className="flex items-center gap-3 text-sm text-navy-500">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(record.recordDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                          {record.provider && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {record.provider.firstName} {record.provider.lastName}
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-navy-600 mt-2 line-clamp-2">{record.description}</p>
                      </div>

                      <div className="text-navy-300 flex-shrink-0 transition-transform duration-200" style={{ transform: selectedRecord?.id === record.id ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>

                    {selectedRecord?.id === record.id && record.extractedData && (
                      <div className="mt-4 pt-4 border-t border-navy-100/50 space-y-3 animate-slide-down">
                        {record.extractedData.medications?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-navy-700 mb-2 uppercase tracking-wider">Medications</h4>
                            <div className="space-y-1">
                              {record.extractedData.medications.map((med: any, idx: number) => (
                                <p key={idx} className="text-xs text-navy-600 flex items-center gap-2">
                                  <span className="w-1 h-1 rounded-full bg-brand-400" />
                                  {med.name}{med.dosage && ` - ${med.dosage}`}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        {record.extractedData.allergies?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-navy-700 mb-2 uppercase tracking-wider">Allergies</h4>
                            <div className="flex flex-wrap gap-1">
                              {record.extractedData.allergies.map((allergy: string, idx: number) => (
                                <span key={idx} className="badge-danger text-[10px]">{allergy}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {record.extractedData.diagnoses?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-navy-700 mb-2 uppercase tracking-wider">Diagnoses</h4>
                            <div className="flex flex-wrap gap-1">
                              {record.extractedData.diagnoses.map((diag: string, idx: number) => (
                                <span key={idx} className="badge-brand text-[10px]">{diag}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="lg:col-span-1">
            <button
              onClick={() => setShowAnalysis(!showAnalysis)}
              className="lg:hidden w-full mb-4 px-4 py-2 bg-brand-50 text-brand-700 rounded-xl text-sm font-semibold"
            >
              {showAnalysis ? 'Hide' : 'Show'} Analysis
            </button>

            {showAnalysis && (
              <div className="sticky top-32 space-y-4 animate-slide-up">
                {analysis?.narrativeSummary && (
                  <div className="card-blur bg-gradient-to-br from-brand-50/80 to-blue-50/80 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <h3 className="font-semibold text-navy-900 text-sm">AI Analysis</h3>
                    </div>
                    <p className="text-xs text-navy-700 leading-relaxed">{analysis.narrativeSummary}</p>
                  </div>
                )}

                {analysis?.duplicates && analysis.duplicates.length > 0 && (
                  <div className="card-blur bg-red-50/50 p-5">
                    <h3 className="font-semibold text-red-900 mb-2 text-sm">Duplicates ({analysis.duplicates.length})</h3>
                    <div className="space-y-2">
                      {analysis.duplicates.map((dup, idx) => (
                        <div key={idx} className="bg-white/60 rounded-xl p-3">
                          <p className="text-xs font-medium text-navy-700">{dup.name} (appeared {dup.count}x)</p>
                          <p className="text-xs text-navy-500 mt-0.5">Dates: {dup.dates.join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis?.conflicts && analysis.conflicts.length > 0 && (
                  <div className="card-blur bg-amber-50/50 p-5">
                    <h3 className="font-semibold text-amber-900 mb-2 text-sm">Drug Conflicts ({analysis.conflicts.length})</h3>
                    <div className="space-y-2">
                      {analysis.conflicts.map((conf, idx) => (
                        <div key={idx} className="bg-white/60 rounded-xl p-3">
                          <p className="text-xs font-medium text-navy-700">{conf.drug1} + {conf.drug2}</p>
                          <p className="text-xs text-navy-600 mt-0.5">{conf.reason}</p>
                          <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${conf.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {conf.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis?.gaps && analysis.gaps.length > 0 && (
                  <div className="card-blur bg-amber-50/50 p-5">
                    <h3 className="font-semibold text-amber-900 mb-2 text-sm">Care Gaps ({analysis.gaps.length})</h3>
                    <div className="space-y-2">
                      {analysis.gaps.map((gap, idx) => (
                        <div key={idx} className="bg-white/60 rounded-xl p-3">
                          <p className="text-xs text-navy-600">{gap.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-navy-400">{gap.date}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              gap.severity === 'high' ? 'bg-red-100 text-red-700' :
                              gap.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-navy-100 text-navy-600'
                            }`}>
                              {gap.severity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!analysis || (analysis.duplicates.length === 0 && analysis.conflicts.length === 0 && analysis.gaps.length === 0)) && (
                  <div className="card-blur bg-emerald-50/50 p-5">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-sm text-emerald-700 font-medium">No issues detected</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
