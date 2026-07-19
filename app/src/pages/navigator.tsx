import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { api } from '../lib/api';

interface PatientData { id: string; firstName: string; lastName: string; }

const SYMPTOM_SUGGESTIONS = [
  'chest pain', 'shortness of breath', 'headache', 'fever', 'cough',
  'stomach pain', 'joint pain', 'fatigue', 'dizziness', 'skin rash',
  'sore throat', 'back pain', 'numbness', 'blurred vision', 'weight loss',
];

export default function NavigatorPage() {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomInput, setSymptomInput] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const session = await api.getSession();
        const user = session.data.user;
        if (user.role !== 'PATIENT') { router.push('/login'); return; }
        setPatient(user.patient);
      } catch { router.push('/login'); }
      finally { setLoading(false); }
    };
    load();
  }, [router]);

  const addSymptom = (s: string) => {
    const trimmed = s.trim();
    if (trimmed && !symptoms.includes(trimmed)) { setSymptoms([...symptoms, trimmed]); setSymptomInput(''); }
  };

  const addCondition = (c: string) => {
    const trimmed = c.trim();
    if (trimmed && !conditions.includes(trimmed)) { setConditions([...conditions, trimmed]); setConditionInput(''); }
  };

  const handleAnalyze = async () => {
    if (!patient || symptoms.length === 0) { setError('Please add at least one symptom'); return; }
    setAnalyzing(true);
    setError(null);
    try {
      const res = await api.navigateCare(patient.id, symptoms, conditions);
      setResult(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to analyze');
    } finally { setAnalyzing(false); }
  };

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
    <Layout patientName={patient ? `${patient.firstName} ${patient.lastName}` : ''} patientId={patient?.id}>
      <div className="space-y-8">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-navy-900 tracking-tight">Care Navigator</h1>
          <p className="text-navy-500 mt-1">Tell us your symptoms and get AI-recommended specialists and care pathways.</p>
        </div>

        {error && (
          <div className="bg-red-50/80 backdrop-blur border border-red-200/50 rounded-xl p-4 animate-slide-down">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card-blur p-6 animate-slide-up">
              <h2 className="font-semibold text-navy-900 mb-4">Describe Your Symptoms</h2>
              <div className="flex gap-2">
                <input type="text" value={symptomInput} onChange={e => setSymptomInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSymptom(symptomInput)}
                  placeholder="Type a symptom and press Enter..." className="input-blur flex-1" />
                <button onClick={() => addSymptom(symptomInput)}
                  className="px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold text-sm">
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {SYMPTOM_SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => addSymptom(s)}
                    className="px-3 py-1.5 bg-navy-100 text-navy-600 text-xs rounded-full hover:bg-navy-200 transition-colors font-medium">
                    + {s}
                  </button>
                ))}
              </div>
              {symptoms.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-navy-400 mb-2 uppercase tracking-wider">Selected symptoms</p>
                  <div className="flex flex-wrap gap-2">
                    {symptoms.map(s => (
                      <span key={s} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 text-sm rounded-full font-medium border border-red-100">
                        {s}
                        <button onClick={() => setSymptoms(symptoms.filter(x => x !== s))} className="text-red-400 hover:text-red-600 ml-1">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="card-blur p-6 animate-slide-up">
              <h2 className="font-semibold text-navy-900 mb-4">Known Conditions (Optional)</h2>
              <div className="flex gap-2">
                <input type="text" value={conditionInput} onChange={e => setConditionInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCondition(conditionInput)}
                  placeholder="e.g., diabetes, hypertension..." className="input-blur flex-1" />
                <button onClick={() => addCondition(conditionInput)}
                  className="px-5 py-2.5 bg-navy-100 text-navy-700 rounded-xl font-semibold text-sm hover:bg-navy-200 transition-colors">
                  Add
                </button>
              </div>
              {conditions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {conditions.map(c => (
                    <span key={c} className="flex items-center gap-1 px-3 py-1.5 bg-brand-50 text-brand-700 text-sm rounded-full font-medium border border-brand-100">
                      {c}
                      <button onClick={() => setConditions(conditions.filter(x => x !== c))} className="text-brand-400 hover:text-brand-600 ml-1">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleAnalyze} disabled={analyzing || symptoms.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold hover:from-brand-700 hover:to-brand-800 transition-all duration-200 shadow-brand disabled:opacity-50 flex items-center justify-center gap-2">
              {analyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Get Care Recommendations
                </>
              )}
            </button>

            {result && (
              <div className="space-y-6 animate-slide-up">
                <div className="card-blur bg-gradient-to-r from-brand-50/80 to-medical-50/80 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-navy-900">AI Care Pathway</h3>
                  </div>
                  <p className="text-sm text-navy-700">{result.aiExplanation}</p>
                </div>

                <div className="card-blur p-6">
                  <h3 className="font-semibold text-navy-900 mb-4">Recommended Specialists</h3>
                  <div className="space-y-3">
                    {result.recommendations?.map((rec: any, i: number) => (
                      <div key={i} className="border-l-4 border-brand-400 pl-4 py-3 bg-navy-50/50 rounded-r-xl">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-navy-900">{rec.specialty}</p>
                            <p className="text-sm text-navy-600">{rec.department}</p>
                            <p className="text-sm text-navy-500 mt-1">{rec.reason}</p>
                          </div>
                          <div className="text-right">
                            <span className={`badge ${
                              rec.urgency === 'Emergency' ? 'badge-danger' :
                              rec.urgency === 'High' ? 'badge-warning' :
                              rec.urgency === 'Medium' ? 'bg-amber-100 text-amber-700 badge' : 'badge-success'
                            }`}>{rec.urgency}</span>
                            <p className="text-xs text-navy-400 mt-1">{Math.round((rec.confidence || 0) * 100)}% confidence</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {result.suggestedFacilities?.length > 0 && (
                  <div className="card-blur p-6">
                    <h3 className="font-semibold text-navy-900 mb-4">Suggested Facilities</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {result.suggestedFacilities.map((f: any, i: number) => (
                        <div key={i} className="p-3 bg-navy-50/50 rounded-xl">
                          <p className="font-medium text-navy-900">{f.name}</p>
                          <p className="text-xs text-navy-500">{f.type}</p>
                          <p className="text-xs text-navy-400">{f.address}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.carePathway && (
                  <div className="card-blur p-6">
                    <h3 className="font-semibold text-navy-900 mb-4">Care Pathway</h3>
                    <div className="whitespace-pre-line text-sm text-navy-700">{result.carePathway}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card-blur bg-gradient-to-br from-purple-50/50 to-pink-50/50 p-6 animate-slide-up">
              <h3 className="font-semibold text-navy-900 mb-3">How it works</h3>
              <ul className="space-y-2.5 text-xs text-navy-600">
                <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold">1</span> Enter your symptoms</li>
                <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold">2</span> Add any known conditions</li>
                <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold">3</span> Our AI analyzes and recommends</li>
                <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold">4</span> Get specialist and facility suggestions</li>
              </ul>
            </div>

            <div className="card-blur bg-amber-50/50 p-4 animate-slide-up">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-700">
                  <strong>Note:</strong> This tool provides navigational guidance only. It does not diagnose diseases.
                  Always consult a healthcare professional.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
