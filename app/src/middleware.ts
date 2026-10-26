import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cookie-presence gate only. The cookies are httpOnly, so this file never tries
 * to validate a token; the API remains the authority on every request.
 */
const PROTECTED = [
  '/dashboard',
  '/timeline',
  '/upload',
  '/appointments',
  '/navigator',
  '/reminders',
  '/facilities',
  '/translate',
  '/doctor-portal',
  '/admin',
];

const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has('mf_access') || request.cookies.has('mf_refresh');

  const isProtected = PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!hasSession && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/timeline/:path*',
    '/upload/:path*',
    '/appointments/:path*',
    '/navigator/:path*',
    '/reminders/:path*',
    '/facilities/:path*',
    '/translate/:path*',
    '/doctor-portal/:path*',
    '/admin/:path*',
    '/login',
    '/register',
    '/forgot-password',
  ],
};
