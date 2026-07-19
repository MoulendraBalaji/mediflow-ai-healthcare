import React, { useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/api';

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Russian',
  'Dutch', 'Swedish', 'Turkish', 'Thai', 'Vietnamese', 'Indonesian',
];

export default function TranslatePage() {
  const [inputText, setInputText] = useState('');
  const [language, setLanguage] = useState('Spanish');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'prescription' | 'translate'>('prescription');

  const handleExplain = async () => {
    if (!inputText.trim()) { setError('Please enter text to explain'); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = mode === 'prescription'
        ? await api.explainPrescription(inputText, language)
        : await api.translateText(inputText, language);
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process');
    } finally { setLoading(false); }
  };

  const samplePrescriptions = [
    'Metformin 500mg - Take twice daily with meals for Type 2 Diabetes',
    'Lisinopril 10mg - Once daily in the morning for blood pressure control',
    'Amoxicillin 500mg - Three times daily for 7 days, take with or without food',
    'Atorvastatin 20mg - Once daily at bedtime for cholesterol management',
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-navy-900 tracking-tight">Prescription Explainer</h1>
          <p className="text-navy-500 mt-1">
            Get simple, multilingual explanations of your prescriptions and medical documents.
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setMode('prescription')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all duration-200 ${
              mode === 'prescription' ? 'bg-brand-600 text-white shadow-brand' : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
            }`}>Explain Prescription</button>
          <button onClick={() => setMode('translate')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all duration-200 ${
              mode === 'translate' ? 'bg-brand-600 text-white shadow-brand' : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
            }`}>Translate Medical Text</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card-blur p-6 animate-slide-up">
              <label className="block text-sm font-semibold text-navy-700 mb-2">
                {mode === 'prescription' ? 'Paste your prescription text' : 'Medical text to translate'}
              </label>
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                rows={6}
                className="input-blur"
                placeholder={mode === 'prescription'
                  ? 'Enter prescription text, medication names, or medical instructions...'
                  : 'Enter medical text to translate...'}
              />
              <div className="mt-4">
                <label className="block text-sm font-semibold text-navy-700 mb-2">Target Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="input-solid">
                  {LANGUAGES.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleExplain} disabled={loading || !inputText.trim()}
                className="mt-4 w-full py-3.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold hover:from-brand-700 hover:to-brand-800 transition-all duration-200 shadow-brand disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : mode === 'prescription' ? `Explain in ${language}` : `Translate to ${language}`}
              </button>
            </div>

            {error && (
              <div className="bg-red-50/80 backdrop-blur border border-red-200/50 rounded-xl p-4 animate-slide-down">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {result && (
              <div className="card-blur p-6 animate-slide-up">
                <h3 className="font-semibold text-navy-900 mb-4">
                  {mode === 'prescription' ? `Explanation (${language})` : `Translation (${language})`}
                </h3>
                <div className="bg-brand-50/50 border border-brand-100 rounded-xl p-4">
                  <p className="text-sm text-navy-800 whitespace-pre-wrap leading-relaxed">
                    {result.explanation || result.translated}
                  </p>
                </div>
                {result.original && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-navy-400 mb-2 uppercase tracking-wider">Original Text</h4>
                    <p className="text-sm text-navy-700 bg-navy-50/50 p-3 rounded-xl">{result.original}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card-blur bg-gradient-to-br from-brand-50/50 to-medical-50/50 p-6 animate-slide-up">
              <h3 className="font-semibold text-navy-900 mb-3">How it works</h3>
              <ul className="space-y-2.5 text-xs text-navy-600">
                <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-[10px] font-bold">1</span> Paste your prescription or medical text</li>
                <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-[10px] font-bold">2</span> Select the target language</li>
                <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-[10px] font-bold">3</span> Get a simple, clear explanation</li>
                <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-[10px] font-bold">4</span> Understand your medications better</li>
              </ul>
            </div>

            <div className="card-blur bg-gradient-to-br from-blue-50/50 to-cyan-50/50 p-6 animate-slide-up">
              <h3 className="font-semibold text-navy-900 mb-3">Try a sample</h3>
              <div className="space-y-2">
                {samplePrescriptions.map((sample, i) => (
                  <button key={i} onClick={() => setInputText(sample)}
                    className="w-full text-left px-3 py-2.5 bg-white/60 rounded-xl text-xs text-navy-700 hover:bg-white transition-colors border border-navy-100/50">
                    {sample.substring(0, 55)}...
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
