"use client";

import Link from "next/link";
import Image from "next/image";
import { useBranding } from "@/hooks/useBranding";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useSession } from "@shared/lib/auth";

const showTestCredentials = process.env["NEXT_PUBLIC_SHOW_TEST_CREDENTIALS"] === "true";

export default function HomePage() {
  const { branding } = useBranding();
  const config = useAppConfig();
  const apiBaseUrl = config.api.baseUrl || "/api/isp/v1/admin";
  const { isLoading: authLoading, isAuthenticated } = useSession();
  const isLoggedIn = isAuthenticated;

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--brand-primary)]"></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 gap-12">
      <div className="text-center space-y-6 max-w-3xl">
        <div className="flex items-center justify-center mb-6">
          {branding.logo?.light || branding.logo?.dark ? (
            <div className="relative h-12 w-48">
              <Image
                src={branding.logo.light || branding.logo.dark || ""}
                alt={branding.productName}
                fill
                className="object-contain dark:hidden"
                priority
              />
              {branding.logo.dark && (
                <Image
                  src={branding.logo.dark}
                  alt={branding.productName}
                  fill
                  className="object-contain hidden dark:block"
                  priority
                />
              )}
            </div>
          ) : (
            <span className="inline-flex items-center rounded-full badge-brand px-4 py-2 text-sm font-medium">
              🚀 {branding.productName}
            </span>
          )}
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-foreground mb-4">
          {branding.productName}
          <span className="text-brand block">{branding.productTagline || "Ready to Deploy"}</span>
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Fiber-to-the-Home (FTTH) Operations Platform. Manage your network infrastructure,
          subscribers, billing, and service delivery with enterprise-grade telecom solutions.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          {isLoggedIn ? (
            <Link href="/dashboard">
              <button className="px-8 py-4 rounded-lg transition-colors text-lg font-medium btn-brand">
                Go to Dashboard
              </button>
            </Link>
          ) : (
            <Link href="/login">
              <button className="px-8 py-4 rounded-lg transition-colors text-lg font-medium btn-brand">
                Sign In
              </button>
            </Link>
          )}
        </div>

        {showTestCredentials && (
          <div className="bg-card/30 backdrop-blur border border-border/50 rounded-lg p-4 mt-8">
            <p className="text-sm text-muted-foreground mb-2">Quick Start - Test Credentials:</p>
            <p className="text-brand font-mono text-sm">newuser / Test123!@#</p>
          </div>
        )}
      </div>

      <section className="grid w-full max-w-6xl gap-6 md:grid-cols-3">
        <div className="bg-card/40 backdrop-blur border border-border/40 rounded-xl p-8 hover:bg-card/60 transition-all">
          <div className="text-sky-400 mb-4 text-2xl">🌐</div>
          <h3 className="text-xl font-semibold text-foreground mb-3">Network Operations</h3>
          <ul className="space-y-2 text-muted-foreground text-sm">
            <li>• FTTH/PON network management</li>
            <li>• OLT/ONU provisioning & monitoring</li>
            <li>• IPAM & DCIM (NetBox)</li>
            <li>• Real-time network diagnostics</li>
          </ul>
        </div>

        <div className="bg-card/40 backdrop-blur border border-border/40 rounded-xl p-8 hover:bg-card/60 transition-all">
          <div className="text-green-400 mb-4 text-2xl">👥</div>
          <h3 className="text-xl font-semibold text-foreground mb-3">Subscriber Management</h3>
          <ul className="space-y-2 text-muted-foreground text-sm">
            <li>• RADIUS authentication & accounting</li>
            <li>• Service plans & bandwidth control</li>
            <li>• CPE management (GenieACS)</li>
            <li>• Subscriber self-service portal</li>
          </ul>
        </div>

        <div className="bg-card/40 backdrop-blur border border-border/40 rounded-xl p-8 hover:bg-card/60 transition-all">
          <div className="text-purple-400 mb-4 text-2xl">💳</div>
          <h3 className="text-xl font-semibold text-foreground mb-3">Business Support Systems</h3>
          <ul className="space-y-2 text-muted-foreground text-sm">
            <li>• Automated billing & invoicing</li>
            <li>• Usage-based billing & rating</li>
            <li>• Payment processing & dunning</li>
            <li>• Revenue analytics & reporting</li>
          </ul>
        </div>
      </section>

      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-8">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
          <span>
            API: <span className="text-emerald-400">{apiBaseUrl.replace(/^https?:\/\//, "")}</span>
          </span>
        </div>
        <div className="w-px h-4 bg-muted"></div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[var(--brand-primary)] rounded-full animate-pulse"></div>
          <span>
            Frontend:{" "}
            <span className="text-brand">
              {typeof window !== "undefined" ? window.location.host : "localhost:3001"}
            </span>
          </span>
        </div>
      </div>
    </main>
  );
}
