import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { api } from '../lib/api';

interface PatientSummary {
  patient: {
    id: string; firstName: string; lastName: string; dateOfBirth: string; gender: string;
    contactNumber?: string; email: string; address?: string; emergencyContact?: string;
  };
  activeMedications: any[];
  allergies: string[];
  diagnoses: string[];
  recentRecords: any[];
  recentAppointments: any[];
  aiSummary: string;
}

interface ProviderData { id: string; firstName: string; lastName: string; specialty: string; }

export default function DoctorPortalPage() {
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [activeTab, setActiveTab] = useState<'patients' | 'analytics'>('patients');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const session = await api.getSession();
        const user = session.data.user;
        if (user.role !== 'DOCTOR') { router.push('/login'); return; }
        setProvider(user.provider);
      } catch { router.push('/login'); }
      finally { setLoading(false); }
    };
    load();
  }, [router]);

  const loadPatientSummary = async (patientId: string) => {
    setSelectedPatientId(patientId);
    setLoadingSummary(true);
    setError(null);
    try {
      const res = await api.getProviderPatientSummary(patientId);
      setSummary(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load patient summary');
    } finally { setLoadingSummary(false); }
  };

  const loadAnalytics = async () => {
    try {
      const res = await api.getHospitalAnalytics();
      setAnalytics(res.data.data);
    } catch { setError('Failed to load analytics'); }
  };

  useEffect(() => {
    if (activeTab === 'analytics' && !analytics) loadAnalytics();
  }, [activeTab]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout patientName={provider ? `Dr. ${provider.firstName} ${provider.lastName}` : ''}>
      <div className="space-y-8">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-navy-900 tracking-tight">Provider Portal</h1>
          <p className="text-navy-500 mt-1">AI-generated patient summaries and hospital analytics</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setActiveTab('patients')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all duration-200 ${
              activeTab === 'patients' ? 'bg-brand-600 text-white shadow-brand' : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
            }`}>Patient Summaries</button>
          <button onClick={() => setActiveTab('analytics')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all duration-200 ${
              activeTab === 'analytics' ? 'bg-brand-600 text-white shadow-brand' : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
            }`}>Hospital Analytics</button>
        </div>

        {error && (
          <div className="bg-red-50/80 backdrop-blur border border-red-200/50 rounded-xl p-4 animate-slide-down">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {activeTab === 'patients' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="card-blur p-6 animate-slide-up">
              <h2 className="font-semibold text-navy-900 mb-4">Select Patient</h2>
              <p className="text-sm text-navy-500 mb-4">Enter a patient ID to view their AI-generated summary:</p>
              <input type="text" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}
                placeholder="Patient ID" className="input-blur mb-3" />
              <button onClick={() => selectedPatientId && loadPatientSummary(selectedPatientId)}
                disabled={!selectedPatientId || loadingSummary}
                className="w-full py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {loadingSummary ? 'Loading...' : 'Load Summary'}
              </button>

              <div className="mt-6 space-y-2">
                <p className="text-xs font-semibold text-navy-400 uppercase tracking-wider">Quick Access (Demo)</p>
                {['robert.anderson@email.com', 'jennifer.martinez@email.com', 'david.thompson@email.com', 'lisa.chen@email.com', 'marcus.johnson@email.com'].map(email => (
                  <button key={email}
                    onClick={async () => {
                      try {
                        const loginRes = await api.login(email, 'demo123');
                        const user = loginRes.data.user;
                        if (user.patientId) loadPatientSummary(user.patientId);
                      } catch {}
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-navy-600 bg-navy-50/50 rounded-xl hover:bg-navy-100 transition-colors">
                    {email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              {loadingSummary ? (
                <div className="card-blur p-12 text-center animate-fade-in">
                  <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
                  <p className="mt-4 text-navy-500 font-medium">Generating AI patient summary...</p>
                </div>
              ) : summary ? (
                <div className="space-y-6 animate-slide-up">
                  <div className="card-blur bg-gradient-to-r from-brand-50/80 to-blue-50/80 p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <h3 className="font-semibold text-navy-900 text-sm">AI-Generated Patient Summary</h3>
                    </div>
                    <p className="text-sm text-navy-700 leading-relaxed">{summary.aiSummary}</p>
                  </div>

                  <div className="card-blur p-6">
                    <h3 className="font-semibold text-navy-900 mb-4">Patient Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-navy-400 text-xs">Name</p><p className="font-medium text-navy-900">{summary.patient.firstName} {summary.patient.lastName}</p></div>
                      <div><p className="text-navy-400 text-xs">DOB</p><p className="font-medium text-navy-900">{new Date(summary.patient.dateOfBirth).toLocaleDateString()}</p></div>
                      <div><p className="text-navy-400 text-xs">Gender</p><p className="font-medium text-navy-900">{summary.patient.gender}</p></div>
                      <div><p className="text-navy-400 text-xs">Contact</p><p className="font-medium text-navy-900">{summary.patient.contactNumber || 'N/A'}</p></div>
                      {summary.patient.emergencyContact && (
                        <div className="col-span-2"><p className="text-navy-400 text-xs">Emergency Contact</p><p className="font-medium text-navy-900">{summary.patient.emergencyContact}</p></div>
                      )}
                    </div>
                  </div>

                  {summary.allergies.length > 0 && (
                    <div className="card-blur bg-red-50/50 p-4">
                      <h4 className="font-semibold text-red-900 text-sm mb-2">Allergies</h4>
                      <div className="flex flex-wrap gap-2">
                        {summary.allergies.map((a, i) => (
                          <span key={i} className="badge-danger">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {summary.diagnoses.length > 0 && (
                    <div className="card-blur bg-purple-50/50 p-4">
                      <h4 className="font-semibold text-purple-900 text-sm mb-2">Diagnoses</h4>
                      <div className="flex flex-wrap gap-2">
                        {summary.diagnoses.map((d, i) => (
                          <span key={i} className="badge-brand">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {summary.activeMedications.length > 0 && (
                    <div className="card-blur p-6">
                      <h4 className="font-semibold text-navy-900 text-sm mb-3">Active Medications</h4>
                      <div className="space-y-2">
                        {summary.activeMedications.map((m, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-navy-50/50 rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-navy-900">{m.name}</p>
                              <p className="text-xs text-navy-500">{m.dosage} - {m.frequency}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card-blur p-12 text-center animate-fade-in">
                  <div className="w-16 h-16 rounded-2xl bg-navy-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-navy-600 font-medium">Select a patient to view their AI-generated summary</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6 animate-slide-up">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Patients', value: analytics.totalPatients, color: 'text-brand-600', bg: 'bg-brand-50' },
                { label: 'Total Appointments', value: analytics.totalAppointments, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Missed Follow-up Rate', value: `${analytics.missedFollowUpRate}%`, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Patient Compliance', value: `${analytics.patientComplianceRate}%`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              ].map((card, i) => (
                <div key={card.label} className="card-blur p-4 text-center animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                  <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                  <p className="text-xs text-navy-500 mt-1 font-medium">{card.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card-blur p-6">
                <h3 className="font-semibold text-navy-900 mb-4">Appointment Bottlenecks</h3>
                {analytics.appointmentBottlenecks?.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.appointmentBottlenecks.map((b: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-navy-50/50 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-navy-900">{b.providerName}</p>
                          <p className="text-xs text-navy-500">{b.specialty}</p>
                        </div>
                        <span className="badge-info">{b.pendingCount} pending</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-navy-500">No bottlenecks detected</p>
                )}
              </div>

              <div className="card-blur p-6">
                <h3 className="font-semibold text-navy-900 mb-4">Compliance Breakdown</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Compliant', value: analytics.complianceBreakdown.compliant, color: 'bg-emerald-500' },
                    { label: 'Partially Compliant', value: analytics.complianceBreakdown.partiallyCompliant, color: 'bg-amber-500' },
                    { label: 'Non-Compliant', value: analytics.complianceBreakdown.nonCompliant, color: 'bg-red-500' },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-sm text-navy-700">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-navy-100 rounded-full h-2">
                          <div className={`${item.color} h-2 rounded-full transition-all duration-500`}
                            style={{ width: `${analytics.totalPatients > 0 ? (item.value / analytics.totalPatients) * 100 : 0}%` }} />
                        </div>
                        <span className="text-sm font-medium text-navy-900 w-8 text-right">{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {analytics.treatmentTimelines?.length > 0 && (
              <div className="card-blur p-6">
                <h3 className="font-semibold text-navy-900 mb-4">Treatment Timelines</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-100">
                        <th className="text-left py-3 font-semibold text-navy-500 text-xs uppercase tracking-wider">Patient</th>
                        <th className="text-left py-3 font-semibold text-navy-500 text-xs uppercase tracking-wider">Treatment</th>
                        <th className="text-left py-3 font-semibold text-navy-500 text-xs uppercase tracking-wider">Start Date</th>
                        <th className="text-left py-3 font-semibold text-navy-500 text-xs uppercase tracking-wider">Duration</th>
                        <th className="text-left py-3 font-semibold text-navy-500 text-xs uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.treatmentTimelines.map((t: any, i: number) => (
                        <tr key={i} className="border-b border-navy-50">
                          <td className="py-3 text-navy-900 font-medium">{t.patientName}</td>
                          <td className="py-3 text-navy-700">{t.treatment}</td>
                          <td className="py-3 text-navy-600">{t.startDate}</td>
                          <td className="py-3 text-navy-600">{t.duration}</td>
                          <td className="py-3">
                            <span className={`badge ${
                              t.status === 'Completed' ? 'badge-success' :
                              t.status === 'Scheduled' ? 'badge-info' : 'bg-navy-100 text-navy-600 badge'
                            }`}>{t.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
