import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { api } from '../lib/api';

interface Reminder {
  id: string;
  reminderType: string;
  title: string;
  description?: string;
  dueDate: string;
  status: string;
  createdAt: string;
}

interface PatientData { id: string; firstName: string; lastName: string; }

export default function RemindersPage() {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [stats, setStats] = useState({ pending: 0, sent: 0, acknowledged: 0, overdue: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const session = await api.getSession();
        const user = session.data.user;
        if (user.role !== 'PATIENT') { router.push('/login'); return; }
        setPatient(user.patient);
        await loadReminders(user.patient.id);
        await loadStats(user.patient.id);
      } catch { router.push('/login'); }
      finally { setLoading(false); }
    };
    load();
  }, [router]);

  const loadReminders = async (patientId: string) => {
    const res = await api.getReminders(patientId);
    setReminders(res.data.reminders || []);
  };

  const loadStats = async (patientId: string) => {
    const res = await api.getReminderStats(patientId);
    setStats(res.data);
  };

  const handleGenerate = async () => {
    if (!patient) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await api.generateCompanion(patient.id);
      setAiSummary(res.data.data?.aiSummary || 'Reminders generated successfully');
      await loadReminders(patient.id);
      await loadStats(patient.id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate reminders');
    } finally { setGenerating(false); }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await api.acknowledgeReminder(id);
      if (patient) { await loadReminders(patient.id); await loadStats(patient.id); }
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteReminder(id);
      if (patient) { await loadReminders(patient.id); await loadStats(patient.id); }
    } catch (err: any) { setError(err.message); }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Medication': return 'badge-info';
      case 'Appointment': return 'badge-success';
      case 'FollowUp': return 'badge-warning';
      case 'Refill': return 'badge-brand';
      default: return 'bg-navy-100 text-navy-600 badge';
    }
  };

  const filteredReminders = filter === 'all' ? reminders
    : filter === 'overdue' ? reminders.filter(r => r.status === 'Pending' && new Date(r.dueDate) < new Date())
    : reminders.filter(r => r.status.toLowerCase() === filter);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const statCards = [
    { label: 'Pending', value: stats.pending, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Overdue', value: stats.overdue, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Acknowledged', value: stats.acknowledged, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total', value: stats.total, color: 'text-navy-600', bg: 'bg-navy-50' },
  ];

  return (
    <Layout patientName={patient ? `${patient.firstName} ${patient.lastName}` : ''} patientId={patient?.id}>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold text-navy-900 tracking-tight">Reminders</h1>
            <p className="text-navy-500 mt-1">Stay on top of your medications, appointments, and follow-ups.</p>
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold hover:from-brand-700 hover:to-brand-800 transition-all duration-200 shadow-brand disabled:opacity-50 text-sm flex items-center gap-2">
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : 'AI Generate Reminders'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50/80 backdrop-blur border border-red-200/50 rounded-xl p-4 animate-slide-down">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {aiSummary && (
          <div className="card-blur bg-gradient-to-r from-brand-50/80 to-medical-50/80 p-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-navy-900 text-sm">AI Companion Summary</h3>
            </div>
            <p className="text-sm text-navy-700">{aiSummary}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <div key={card.label} className={`card-blur p-4 text-center animate-slide-up stagger-${i + 1}`}>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-xs text-navy-500 mt-1 font-medium">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {['all', 'pending', 'overdue', 'acknowledged'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                filter === f ? 'bg-brand-600 text-white shadow-brand' : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {filteredReminders.length === 0 ? (
          <div className="card-blur p-12 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-navy-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-navy-600 font-medium">No reminders to show</p>
            <button onClick={handleGenerate} className="mt-4 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold text-sm">
              Generate AI Reminders
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReminders.map((rem, i) => {
              const isOverdue = rem.status === 'Pending' && new Date(rem.dueDate) < new Date();
              return (
                <div key={rem.id}
                  className={`card-blur p-4 animate-slide-up ${isOverdue ? 'border-l-4 border-l-red-400' : ''}`}
                  style={{ animationDelay: `${i * 0.03}s` }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-navy-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-navy-900">{rem.title}</h3>
                          <span className={getTypeColor(rem.reminderType)}>{rem.reminderType}</span>
                          {isOverdue && <span className="badge-danger">Overdue</span>}
                        </div>
                        {rem.description && <p className="text-sm text-navy-600 mt-1">{rem.description}</p>}
                        <p className="text-xs text-navy-400 mt-1">Due: {new Date(rem.dueDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {rem.status === 'Pending' && (
                        <button onClick={() => handleAcknowledge(rem.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-100">
                          Acknowledge
                        </button>
                      )}
                      <button onClick={() => handleDelete(rem.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-100">
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
