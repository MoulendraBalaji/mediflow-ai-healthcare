import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api, setToken } from '../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.login(email, password);
      const { token, user } = response.data;

      setToken(token);
      localStorage.setItem('user', JSON.stringify(user));

      if (user.role === 'PATIENT') {
        router.push('/dashboard');
      } else if (user.role === 'DOCTOR') {
        router.push('/doctor-portal');
      } else {
        router.push('/admin');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden gradient-medical flex items-center justify-center p-4">
      <div className="floating-orb floating-orb-1" />
      <div className="floating-orb floating-orb-2" />
      <div className="floating-orb floating-orb-3" />

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <div className="glass-card rounded-3xl p-8 sm:p-10 shadow-float-lg">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-medical-500 flex items-center justify-center mx-auto mb-4 shadow-lg animate-float-slow">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-navy-900">Welcome back</h1>
            <p className="text-navy-500 mt-2 text-sm">Sign in to your MediFlow account</p>
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

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-navy-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-blur"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-semibold text-navy-700">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input-blur"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white font-semibold rounded-xl
                         hover:from-brand-700 hover:to-brand-800 active:from-brand-800 active:to-brand-900
                         transition-all duration-200 shadow-brand hover:shadow-lg
                         hover:-translate-y-0.5 active:translate-y-0
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                         flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-navy-500">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                Create one now
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
