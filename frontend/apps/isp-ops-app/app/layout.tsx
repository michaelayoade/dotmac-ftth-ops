import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ReactNode } from "react";

import { ClientProviders } from "@/providers/ClientProviders";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { platformConfig } from "@/lib/config";
import PWAProvider from "@/components/pwa/PWAProvider";
import InstallPrompt from "@/components/pwa/InstallPrompt";

const { branding } = platformConfig;
const productName = branding.productName || "DotMac Platform";
const productTagline =
  branding.productTagline || "Reusable SaaS backend and APIs to launch faster.";
const favicon = process.env["NEXT_PUBLIC_FAVICON"] ?? "/favicon.ico";

export const metadata: Metadata = {
  title: productName,
  description: productTagline,
  icons: [{ rel: "icon", url: favicon }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: productName,
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
      </head>
      <body suppressHydrationWarning>
        <ErrorBoundary>
          <PWAProvider>
            <ClientProviders>
              {children}
              <InstallPrompt />
            </ClientProviders>
          </PWAProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
