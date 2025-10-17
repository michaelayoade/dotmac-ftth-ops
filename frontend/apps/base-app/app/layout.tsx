import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';

import { ClientProviders } from '@/providers/ClientProviders';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'DotMac Platform';
const productTagline = process.env.NEXT_PUBLIC_PRODUCT_TAGLINE ?? 'Reusable SaaS backend and APIs to launch faster.';
const favicon = process.env.NEXT_PUBLIC_FAVICON ?? '/favicon.ico';

export const metadata: Metadata = {
  title: productName,
  description: productTagline,
  icons: [{ rel: 'icon', url: favicon }],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ErrorBoundary>
          <ClientProviders>{children}</ClientProviders>
        </ErrorBoundary>
      </body>
    </html>
  );
}
