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
  const apiBaseUrl = config.api.baseUrl || "/api/platform/v1";
  const { isLoading: authLoading, isAuthenticated } = useSession();
  const isLoggedIn = isAuthenticated;

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--brand-primary)]" />
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
                unoptimized
              />
              {branding.logo.dark && (
                <Image
                  src={branding.logo.dark}
                  alt={branding.productName}
                  fill
                  className="object-contain hidden dark:block"
                  priority
                  unoptimized
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
          {branding.productName} Platform Admin
          <span className="text-brand block">
            {branding.productTagline || "Multi-Tenant Management"}
          </span>
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Enterprise Multi-Tenant Orchestration Platform. Manage ISP tenants, licensing, compliance,
          and global platform operations with enterprise-grade security and governance.
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
                Platform Admin Sign In
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
          <div className="text-sky-400 mb-4 text-2xl">🏢</div>
          <h3 className="text-xl font-semibold text-foreground mb-3">Multi-Tenant Orchestration</h3>
          <ul className="space-y-2 text-muted-foreground text-sm">
            <li>• ISP tenant provisioning & isolation</li>
            <li>• Tenant lifecycle management</li>
            <li>• Resource allocation & quotas</li>
            <li>• Cross-tenant analytics dashboard</li>
          </ul>
        </div>

        <div className="bg-card/40 backdrop-blur border border-border/40 rounded-xl p-8 hover:bg-card/60 transition-all">
          <div className="text-green-400 mb-4 text-2xl">🔐</div>
          <h3 className="text-xl font-semibold text-foreground mb-3">Security & Compliance</h3>
          <ul className="space-y-2 text-muted-foreground text-sm">
            <li>• Global RBAC & permission management</li>
            <li>• Audit logging & compliance reports</li>
            <li>• Data residency & encryption</li>
            <li>• Security posture monitoring</li>
          </ul>
        </div>

        <div className="bg-card/40 backdrop-blur border border-border/40 rounded-xl p-8 hover:bg-card/60 transition-all">
          <div className="text-purple-400 mb-4 text-2xl">📊</div>
          <h3 className="text-xl font-semibold text-foreground mb-3">Licensing & Operations</h3>
          <ul className="space-y-2 text-muted-foreground text-sm">
            <li>• Feature flag & license management</li>
            <li>• Usage-based billing for tenants</li>
            <li>• Platform health monitoring</li>
            <li>• Automated maintenance windows</li>
          </ul>
        </div>
      </section>

      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-8">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span>
            API: <span className="text-emerald-400">{apiBaseUrl.replace(/^https?:\/\//, "")}</span>
          </span>
        </div>
        <div className="w-px h-4 bg-muted" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[var(--brand-primary)] rounded-full animate-pulse" />
          <span>
            Frontend:{" "}
            <span className="text-brand">
              {typeof window !== "undefined" ? window.location.host : "localhost:3002"}
            </span>
          </span>
        </div>
      </div>
    </main>
  );
}
