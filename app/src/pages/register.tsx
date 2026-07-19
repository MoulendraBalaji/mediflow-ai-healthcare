import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api, setToken } from '../lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('PATIENT');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.register({
        name, email, password, role, dateOfBirth, gender,
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' ') || '',
      });
      const { token, user } = response.data;
      setToken(token);
      localStorage.setItem('user', JSON.stringify(user));
      router.push(role === 'PATIENT' ? '/dashboard' : '/doctor-portal');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden gradient-medical flex items-center justify-center p-4">
      <div className="floating-orb floating-orb-1" />
      <div className="floating-orb floating-orb-2" />
      <div className="floating-orb floating-orb-3" />

      <div className="relative z-10 w-full max-w-lg animate-scale-in">
        <div className="glass-card rounded-3xl p-8 sm:p-10 shadow-float-lg">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-medical-500 flex items-center justify-center mx-auto mb-4 shadow-lg animate-float-slow">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-navy-900">Create account</h1>
            <p className="text-navy-500 mt-2 text-sm">Join MediFlow for better healthcare</p>
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 1 ? 'w-12 bg-brand-600' : 'w-12 bg-navy-200'}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 2 ? 'w-12 bg-brand-600' : 'w-12 bg-navy-200'}`} />
          </div>

          {error && (
            <div className="bg-red-50/80 backdrop-blur border border-red-200/50 rounded-xl p-4 mb-6 animate-slide-down">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-navy-700">I am a</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('PATIENT')}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                      role === 'PATIENT'
                        ? 'border-brand-500 bg-brand-50/50 shadow-brand'
                        : 'border-navy-200 hover:border-navy-300 bg-white/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">🧑‍⚕️</div>
                    <p className="text-sm font-semibold text-navy-900">Patient</p>
                    <p className="text-xs text-navy-400 mt-0.5">Access my health data</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('DOCTOR')}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                      role === 'DOCTOR'
                        ? 'border-brand-500 bg-brand-50/50 shadow-brand'
                        : 'border-navy-200 hover:border-navy-300 bg-white/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">⚕️</div>
                    <p className="text-sm font-semibold text-navy-900">Provider</p>
                    <p className="text-xs text-navy-400 mt-0.5">Manage patient care</p>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-navy-700">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input-blur"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-navy-700">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-blur"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-navy-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-blur"
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white font-semibold rounded-xl
                           hover:from-brand-700 hover:to-brand-800 transition-all duration-200 shadow-brand hover:shadow-lg
                           hover:-translate-y-0.5 active:translate-y-0"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleRegister} className="space-y-5 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-navy-700">Date of birth</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                    className="input-blur"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-navy-700">Gender</label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value)}
                    className="input-blur"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3.5 bg-navy-100 text-navy-700 font-semibold rounded-xl
                             hover:bg-navy-200 transition-all duration-200"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white font-semibold rounded-xl
                             hover:from-brand-700 hover:to-brand-800 transition-all duration-200 shadow-brand hover:shadow-lg
                             disabled:opacity-50 disabled:cursor-not-allowed
                             flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create account'
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 text-center">
            <p className="text-sm text-navy-500">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-white/50 mt-6">
          Secure, AI-powered healthcare navigation
        </p>
      </div>
    </div>
  );
}
