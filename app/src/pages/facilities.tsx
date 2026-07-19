import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/api';

interface Facility {
  id: string;
  name: string;
  type: string;
  address: string;
  contactNumber?: string;
  providerCount?: number;
  specialties?: string[];
}

interface PatientData { id: string; firstName: string; lastName: string; }

export default function FacilitiesPage() {
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [emergencyFacilities, setEmergencyFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'emergency'>('all');

  useEffect(() => {
    const load = async () => {
      try {
        const session = await api.getSession();
        const user = session.data.user;
        if (user.role === 'PATIENT') setPatient(user.patient);
        await loadFacilities();
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, []);

  const loadFacilities = async (type?: string) => {
    try {
      const [allRes, emergRes] = await Promise.all([
        api.getNearbyFacilities(type, 20),
        api.getEmergencyFacilities(),
      ]);
      setFacilities(allRes.data.facilities || []);
      setEmergencyFacilities(emergRes.data.facilities || []);
    } catch {}
  };

  const handleFilter = async (type: string) => {
    setFilterType(type);
    await loadFacilities(type || undefined);
  };

  const getTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'hospital': return 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4';
      case 'clinic': return 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
      case 'pharmacy': return 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z';
      case 'lab': return 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z';
      default: return 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5';
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

  const displayedFacilities = activeTab === 'emergency' ? emergencyFacilities : facilities;

  return (
    <Layout patientName={patient ? `${patient.firstName} ${patient.lastName}` : ''} patientId={patient?.id}>
      <div className="space-y-8">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-navy-900 tracking-tight">Nearby Facilities</h1>
          <p className="text-navy-500 mt-1">Find hospitals, pharmacies, labs, and emergency services near you.</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setActiveTab('all')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all duration-200 ${
              activeTab === 'all' ? 'bg-brand-600 text-white shadow-brand' : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
            }`}>All Facilities</button>
          <button onClick={() => setActiveTab('emergency')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all duration-200 ${
              activeTab === 'emergency' ? 'bg-red-600 text-white shadow-lg' : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
            }`}>Emergency</button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['', 'Hospital', 'Clinic', 'Pharmacy', 'Lab'].map(type => (
            <button key={type} onClick={() => handleFilter(type)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                filterType === type ? 'bg-brand-600 text-white shadow-brand' : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
              }`}>
              {type || 'All Types'}
            </button>
          ))}
        </div>

        {displayedFacilities.length === 0 ? (
          <div className="card-blur p-12 text-center animate-fade-in">
            <p className="text-navy-600 font-medium">No facilities found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedFacilities.map((f, i) => (
              <div key={f.id} className="card-blur p-6 animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getTypeIcon(f.type)} />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-navy-900">{f.name}</h3>
                    <span className="badge-brand text-[10px] mt-1">{f.type}</span>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-navy-600 flex items-start gap-1.5">
                    <svg className="w-3.5 h-3.5 text-navy-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {f.address}
                  </p>
                  {f.contactNumber && (
                    <p className="text-sm text-navy-600 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-navy-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {f.contactNumber}
                    </p>
                  )}
                  {f.specialties?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {f.specialties.slice(0, 3).map((s, idx) => (
                        <span key={idx} className="badge-medical text-[10px]">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
                {f.contactNumber && (
                  <a href={`tel:${f.contactNumber}`}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-700 text-white text-sm rounded-xl font-semibold hover:from-brand-700 hover:to-brand-800 transition-all duration-200 shadow-brand">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Call Now
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
