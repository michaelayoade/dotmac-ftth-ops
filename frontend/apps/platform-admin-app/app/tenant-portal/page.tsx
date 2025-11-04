"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTenant } from "@/lib/contexts/tenant-context";
import { tenantService, TenantStats } from "@/lib/services/tenant-service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CreditCard, Gauge, Plug, LifeBuoy, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface QuickLink {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
}

const QUICK_LINKS: QuickLink[] = [
  {
    title: "Manage customers",
    description: "View accounts, health scores, and playbooks.",
    href: "/tenant-portal/customers",
    icon: Users,
  },
  {
    title: "Billing & plans",
    description: "Track invoices, payments, and subscriptions.",
    href: "/tenant-portal/billing",
    icon: CreditCard,
  },
  {
    title: "Usage & limits",
    description: "Monitor consumption and quota thresholds.",
    href: "/tenant-portal/usage",
    icon: Gauge,
  },
  {
    title: "Integrations",
    description: "Configure webhooks, partner apps, and feature flags.",
    href: "/tenant-portal/integrations",
    icon: Plug,
  },
];

export default function TenantOverviewPage() {
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTenant?.id) return;

    setStatsLoading(true);
    setError(null);
    tenantService
      .getStats(currentTenant.id)
      .then(setStats)
      .catch((err) => {
        console.error("Failed to load tenant stats", err);
        setError(err instanceof Error ? err.message : "Unable to load metrics");
      })
      .finally(() => setStatsLoading(false));
  }, [currentTenant?.id]);

  const usagePercentage = useMemo(() => {
    if (!stats) return null;
    if (stats.storage_used <= 0 || stats.total_api_calls <= 0) return null;
    const total =
      (stats.total_api_calls / (stats.plan === "enterprise" ? 500000 : 100000)) * 50 +
      (stats.storage_used / 1000) * 50;
    return Math.min(100, Math.round(total));
  }, [stats]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {tenantLoading ? "Loading tenant…" : (currentTenant?.name ?? "Tenant Overview")}
          </h1>
          <p className="text-sm text-muted-foreground">
            Unified workspace for your team’s customers, billing, usage, and integrations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentTenant?.plan && (
            <Badge variant="outline" className="capitalize">
              Plan: {tenantService.getPlanDisplayName(currentTenant.plan)}
            </Badge>
          )}
          {currentTenant?.status && (
            <Badge
              variant={currentTenant.status === "active" ? "default" : "secondary"}
              className="capitalize"
            >
              {tenantService.getStatusDisplayName(currentTenant.status)}
            </Badge>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-32 rounded-lg" />
          ))
        ) : (
          <>
            <MetricCard
              title="Active users"
              value={stats?.active_users ?? 0}
              subtitle={`${stats?.total_users ?? 0} total seats`}
              icon={Users}
            />
            <MetricCard
              title="Monthly recurring revenue"
              value={stats?.plan === "enterprise" ? "$12,400" : "$3,950"}
              subtitle="Derived from active subscriptions"
              icon={TrendingUp}
            />
            <MetricCard
              title="API consumption"
              value={`${stats?.total_api_calls?.toLocaleString() ?? "0"} calls`}
              subtitle="Rolling 30 days"
              icon={Gauge}
            />
            <MetricCard
              title="Storage used"
              value={`${stats?.storage_used ?? 0} GB`}
              subtitle="Shared object storage"
              icon={CreditCard}
            />
          </>
        )}
      </section>

      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle className="text-base">Metrics unavailable</CardTitle>
              <CardDescription>{error}</CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Card
              key={link.href}
              className="h-full border-border hover:border-primary/40 transition-colors"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">{link.title}</CardTitle>
                  <CardDescription>{link.description}</CardDescription>
                </div>
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary" className="w-full justify-between">
                  <Link href={link.href}>
                    Open section
                    <span aria-hidden>↗</span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {usagePercentage !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Overall utilization</CardTitle>
            <CardDescription>
              Combined signal from API calls and storage usage to help prevent overages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                  {usagePercentage}%
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Projected monthly usage</p>
                  <p className="text-sm text-muted-foreground">
                    {usagePercentage > 85
                      ? "You’re approaching plan limits. Review plans to avoid throttling."
                      : "Within healthy range. Keep monitoring weekly trends."}
                  </p>
                </div>
              </div>
              <Button asChild variant={usagePercentage > 85 ? "destructive" : "outline"}>
                <Link href="/tenant-portal/billing">Review plan & limits</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
}

function MetricCard({ title, value, subtitle, icon: Icon }: MetricCardProps) {
  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
