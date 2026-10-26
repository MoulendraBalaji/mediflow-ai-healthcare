import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useState } from 'react';
import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query';
import '../styles/globals.css';
import { AuthProvider } from '../lib/auth';
import { ApiError } from '../lib/api';

const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof ApiError) {
        if ([400, 401, 403, 404, 422].includes(error.status)) return false;
      }
      return failureCount < 2;
    },
  },
  mutations: {
    retry: false,
  },
};

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions }));

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      </QueryClientProvider>
    </>
  );
}
