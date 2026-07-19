import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../components/Layout';
import AgentActivityLog from '../components/AgentActivityLog';
import { api } from '../lib/api';

interface PatientData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Stats {
  completedConsultations: number;
  pendingAppointments: number;
  activeMedications: number;
  upcomingFollowUps: number;
}

interface Reminder {
  id: string;
  title: string;
  reminderType: string;
  dueDate: string;
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [stats, setStats] = useState<Stats>({ completedConsultations: 0, pendingAppointments: 0, activeMedications: 0, upcomingFollowUps: 0 });
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [insight, setInsight] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const sessionResponse = await api.getSession();
        const user = sessionResponse.data.user;
        if (user.role !== 'PATIENT') { router.push('/login'); return; }

        const patientData = user.patient;
        setPatient(patientData);

        if (patientData.id) {
          const [metricsRes, remindersRes] = await Promise.all([
            api.getDashboardMetrics(patientData.id),
            api.getReminders(patientData.id),
          ]);

          setStats({
            completedConsultations: metricsRes.data.completedConsultations,
            pendingAppointments: metricsRes.data.pendingAppointments,
            activeMedications: metricsRes.data.activeMedications,
            upcomingFollowUps: metricsRes.data.upcomingFollowUps,
          });

          setReminders((remindersRes.data.reminders || []).slice(0, 5));

          api.generateInsight(patientData.id).then(res => {
            setInsight(res.data.data);
          }).catch(() => {});
        }

        setError(null);
      } catch (err: any) {
        console.error('Error loading dashboard:', err);
        setError(err.message);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [router]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-navy-500 font-medium">Loading your dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const statCards = [
    { label: 'Consultations', value: stats.completedConsultations, color: 'from-brand-500 to-brand-600', bgColor: 'bg-brand-50', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Appointments', value: stats.pendingAppointments, color: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-50', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { label: 'Medications', value: stats.activeMedications, color: 'from-emerald-500 to-emerald-600', bgColor: 'bg-emerald-50', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { label: 'Follow-ups', value: stats.upcomingFollowUps, color: 'from-amber-500 to-amber-600', bgColor: 'bg-amber-50', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  const quickLinks = [
    { href: '/upload', label: 'Upload Records', desc: 'Add documents', gradient: 'from-blue-500 to-cyan-500', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
    { href: '/navigator', label: 'Navigator', desc: 'Find specialists', gradient: 'from-purple-500 to-pink-500', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
    { href: '/reminders', label: 'Reminders', desc: 'Stay on track', gradient: 'from-orange-500 to-amber-500', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { href: '/facilities', label: 'Facilities', desc: 'Nearby care', gradient: 'from-emerald-500 to-teal-500', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  ];

  return (
    <Layout patientName={patient ? `${patient.firstName} ${patient.lastName}` : ''} patientId={patient?.id}>
      {error && (
        <div className="bg-red-50/80 backdrop-blur border border-red-200/50 rounded-xl p-4 mb-6 animate-slide-down">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      <div className="space-y-8">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-navy-900 tracking-tight">
            Welcome back, <span className="bg-gradient-to-r from-brand-600 to-medical-600 bg-clip-text text-transparent">{patient?.firstName}</span>
          </h1>
          <p className="text-navy-500 mt-1">
            Your personalized healthcare dashboard. Monitor your care journey and connect with your providers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <div
              key={card.label}
              className={`card-blur p-6 animate-slide-up stagger-${i + 1}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-navy-500 text-sm font-medium">{card.label}</p>
                  <p className={`text-3xl font-bold mt-2 bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
                    {card.value}
                  </p>
                </div>
                <div className={`w-12 h-12 ${card.bgColor} rounded-xl flex items-center justify-center`}>
                  <svg className={`w-6 h-6 bg-gradient-to-r ${card.color} bg-clip-text`} style={{color: 'inherit'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {insight && (
              <div className="card-blur bg-gradient-to-r from-brand-50/80 to-medical-50/80 p-6 animate-slide-up">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-navy-900">Health Insight</h3>
                </div>
                <p className="text-sm text-navy-700 mb-3">{insight.summary}</p>
                {insight.recommendations && (
                  <ul className="space-y-1.5">
                    {insight.recommendations.map((rec: string, i: number) => (
                      <li key={i} className="text-xs text-navy-600 flex items-start gap-2">
                        <span className="text-brand-500 mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="card-blur p-6 animate-slide-up">
              <h2 className="text-xl font-bold text-navy-900 mb-2">Diagnostic History</h2>
              <p className="text-navy-500 text-sm mb-4">
                Your complete medical record timeline. View all encounters, medications, and lab results.
              </p>
              <Link href="/timeline" className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold hover:from-brand-700 hover:to-brand-800 transition-all duration-200 shadow-brand hover:shadow-lg hover:-translate-y-0.5 text-sm">
                View Full Timeline
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickLinks.map((link, i) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`card-blur p-4 group animate-slide-up stagger-${i + 1}`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${link.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-navy-900">{link.label}</p>
                  <p className="text-xs text-navy-400 mt-0.5">{link.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {reminders.length > 0 && (
              <div className="card-blur overflow-hidden animate-slide-up">
                <div className="bg-gradient-to-r from-amber-50/80 to-orange-50/80 px-5 py-4 border-b border-navy-100/50">
                  <h3 className="font-semibold text-navy-900 text-sm">Upcoming Reminders</h3>
                </div>
                <div className="divide-y divide-navy-100/50">
                  {reminders.map(rem => (
                    <div key={rem.id} className="px-5 py-3 hover:bg-navy-50/50 transition-colors">
                      <p className="text-sm font-medium text-navy-900">{rem.title}</p>
                      <p className="text-xs text-navy-400 mt-0.5">{new Date(rem.dueDate).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-navy-100/50">
                  <Link href="/reminders" className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                    View all reminders →
                  </Link>
                </div>
              </div>
            )}

            {patient && <AgentActivityLog patientId={patient.id} />}

            <div className="card-blur bg-gradient-to-br from-brand-50/50 to-medical-50/50 p-6 animate-slide-up">
              <h3 className="font-semibold text-navy-900 mb-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-brand-100 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                AI Agents
              </h3>
              <ul className="space-y-2 text-sm text-navy-600">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-brand-400" /><strong>Intake</strong>: Extracts info from documents</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-medical-400" /><strong>Timeline</strong>: Detects care gaps</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" /><strong>Navigator</strong>: Recommends specialists</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><strong>Companion</strong>: Manages reminders</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /><strong>Insight</strong>: Health analytics</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
