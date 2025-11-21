import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ReactNode } from "react";

// import { RuntimeConfigProvider } from "@shared/runtime/RuntimeConfigContext";

import { ClientProviders } from "@/providers/ClientProviders";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { platformConfig } from "@/lib/config";
import PWAProvider from "@/components/pwa/PWAProvider";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import { ClientMSWProvider } from "@shared/mocks/ClientMSWProvider";
import { RuntimeConfigBoundary } from "@/components/RuntimeConfigBoundary";

const FALLBACK_PRODUCT_NAME = "DotMac Platform";
const FALLBACK_PRODUCT_TAGLINE = "Reusable SaaS backend and APIs to launch faster.";
const FALLBACK_FAVICON = process.env["NEXT_PUBLIC_FAVICON"] ?? "/favicon.ico";

export const metadata: Metadata = {
  title: FALLBACK_PRODUCT_NAME,
  description: FALLBACK_PRODUCT_TAGLINE,
  icons: [{ rel: "icon", url: FALLBACK_FAVICON }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: FALLBACK_PRODUCT_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default function RootLayout({ children }: { children: ReactNode }) {
  const branding = platformConfig.branding;
  const productName = branding.productName || FALLBACK_PRODUCT_NAME;
  const productTagline = branding.productTagline || FALLBACK_PRODUCT_TAGLINE;
  const favicon = branding.faviconUrl || FALLBACK_FAVICON;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={productName} />
        <link rel="apple-touch-icon" href="/assets/icon-192x192.png" />
        <link rel="icon" href={favicon} />
      </head>
      <body suppressHydrationWarning>
        <RuntimeConfigBoundary>
          <ErrorBoundary>
            <PWAProvider>
              <ClientMSWProvider />
              <ClientProviders>
                {children}
                <InstallPrompt />
              </ClientProviders>
            </PWAProvider>
          </ErrorBoundary>
        </RuntimeConfigBoundary>
      </body>
    </html>
  );
}
