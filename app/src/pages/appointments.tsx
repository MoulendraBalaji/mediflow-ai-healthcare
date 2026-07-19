import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { api } from '../lib/api';

interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  facility?: { name: string; address: string; facilityType: string };
}

interface PatientData { id: string; firstName: string; lastName: string; }

export default function AppointmentsPage() {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState('Medium');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeSlots = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM'];

  useEffect(() => {
    const load = async () => {
      try {
        const session = await api.getSession();
        const user = session.data.user;
        if (user.role !== 'PATIENT') { router.push('/login'); return; }
        setPatient(user.patient);
        const [appts, provs] = await Promise.all([
          api.getAppointments(user.patient.id),
          api.getAvailableProviders(),
        ]);
        setAppointments(appts.data.appointments || []);
        setProviders(provs.data.providers || provs.data || []);
      } catch { router.push('/login'); }
      finally { setLoading(false); }
    };
    load();
  }, [router]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient || !selectedProvider || !selectedDate) { setError('Please fill all required fields'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const provider = providers.find(p => p.id === selectedProvider);
      await api.createAppointment({
        patientId: patient.id, providerId: selectedProvider,
        facilityId: provider?.facility ? (provider as any).facilityId || (provider as any).facility?.id || '' : '',
        appointmentDate: selectedDate, appointmentTime: selectedTime, reason, urgency,
      });
      setSuccess(true);
      setShowBooking(false);
      const appts = await api.getAppointments(patient.id);
      setAppointments(appts.data.appointments || []);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to book appointment');
    } finally { setSubmitting(false); }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'badge-info';
      case 'Completed': return 'badge-success';
      case 'Cancelled': return 'bg-navy-100 text-navy-600 badge';
      case 'Missed': return 'badge-danger';
      default: return 'bg-navy-100 text-navy-600 badge';
    }
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
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold text-navy-900 tracking-tight">Appointments</h1>
            <p className="text-navy-500 mt-1">Manage your healthcare appointments and schedule new visits.</p>
          </div>
          <button onClick={() => setShowBooking(!showBooking)}
            className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold hover:from-brand-700 hover:to-brand-800 transition-all duration-200 shadow-brand text-sm">
            {showBooking ? 'Cancel' : '+ Book Appointment'}
          </button>
        </div>

        {success && (
          <div className="bg-emerald-50/80 backdrop-blur border border-emerald-200/50 rounded-xl p-4 animate-slide-down">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-emerald-700 font-medium">Appointment booked successfully!</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50/80 backdrop-blur border border-red-200/50 rounded-xl p-4 animate-slide-down">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {showBooking && (
          <div className="card-blur p-6 animate-scale-in">
            <h2 className="text-xl font-bold text-navy-900 mb-4">Book New Appointment</h2>
            <form onSubmit={handleBook} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-navy-700">Specialist</label>
                  <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)} className="input-solid" required>
                    <option value="">Choose a provider...</option>
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>Dr. {p.firstName} {p.lastName} - {p.specialty}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-navy-700">Date</label>
                  <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="input-solid" required />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-navy-700">Time</label>
                  <select value={selectedTime} onChange={e => setSelectedTime(e.target.value)} className="input-solid">
                    {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-navy-700">Urgency</label>
                  <select value={urgency} onChange={e => setUrgency(e.target.value)} className="input-solid">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-navy-700">Reason for Visit</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="input-solid" placeholder="Describe your symptoms or reason for visit..." />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold hover:from-brand-700 hover:to-brand-800 transition-all duration-200 shadow-brand disabled:opacity-50">
                {submitting ? 'Booking...' : 'Confirm Appointment'}
              </button>
            </form>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-navy-900">Your Appointments</h2>
          {appointments.length === 0 ? (
            <div className="card-blur p-12 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-navy-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-navy-600 font-medium">No appointments yet</p>
              <button onClick={() => setShowBooking(true)} className="mt-4 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold text-sm">
                Book your first appointment
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt, i) => (
                <div key={appt.id} className="card-blur p-6 animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-navy-900">Dr. {appt.provider?.firstName} {appt.provider?.lastName}</h3>
                        <span className={getStatusStyle(appt.status)}>{appt.status}</span>
                      </div>
                      <p className="text-sm text-navy-600">{appt.reason || 'General consultation'}</p>
                      <p className="text-sm text-navy-500 mt-1 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(appt.appointmentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at {appt.appointmentTime}
                      </p>
                      {appt.facility && <p className="text-xs text-navy-400 mt-1">{appt.facility.name}</p>}
                    </div>
                    {appt.urgency && (
                      <span className={`badge ${
                        appt.urgency === 'High' ? 'badge-danger' :
                        appt.urgency === 'Medium' ? 'badge-warning' : 'badge-success'
                      }`}>{appt.urgency}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
