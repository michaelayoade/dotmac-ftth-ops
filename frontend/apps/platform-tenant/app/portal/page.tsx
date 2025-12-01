"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from "@dotmac/ui";
import { Button } from "@dotmac/primitives";
import {
  Users,
  Gauge,
  CreditCard,
  Plug,
  TrendingUp,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  useTenantStats,
  useTenantSubscription,
  useUsageMetrics,
} from "@/hooks/useTenantPortal";
import { useTenantAuth } from "@/lib/auth/TenantAuthContext";

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export default function DashboardPage() {
  const { user } = useTenantAuth();
  const { data: stats, isLoading: statsLoading } = useTenantStats();
  const { data: subscription, isLoading: subLoading } = useTenantSubscription();
  const { data: usage, isLoading: usageLoading } = useUsageMetrics();

  const isLoading = statsLoading || subLoading || usageLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const usagePercentage =
    usage?.api_calls?.percentage && usage?.storage?.percentage
      ? Math.round((usage.api_calls.percentage + usage.storage.percentage) / 2)
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {user?.tenant_name || "Tenant Overview"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Unified workspace for billing, usage, and team management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {subscription?.plan_name && (
            <Badge variant="outline" className="capitalize">
              Plan: {subscription.plan_name}
            </Badge>
          )}
          {subscription?.status && (
            <Badge
              variant={subscription.status === "active" ? "default" : "secondary"}
              className="capitalize"
            >
              {subscription.status}
            </Badge>
          )}
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Active Users"
          value={stats?.active_users ?? 0}
          subtitle={`${stats?.total_users ?? 0} total seats`}
          icon={Users}
        />
        <MetricCard
          title="Monthly Cost"
          value={formatCurrency(subscription?.price_amount ?? 0)}
          subtitle={subscription?.billing_cycle ?? "monthly"}
          icon={TrendingUp}
        />
        <MetricCard
          title="API Consumption"
          value={`${stats?.total_api_calls?.toLocaleString() ?? "0"}`}
          subtitle="calls this period"
          icon={Gauge}
        />
        <MetricCard
          title="Storage Used"
          value={`${stats?.storage_used ?? 0} GB`}
          subtitle="of allocated storage"
          icon={CreditCard}
        />
      </section>

      {/* Usage Warning */}
      {usagePercentage > 80 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <CardTitle className="text-base">Approaching Usage Limits</CardTitle>
              <CardDescription>
                You are using {usagePercentage}% of your plan limits. Consider
                upgrading to avoid throttling.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Quick Links */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickLinkCard
          title="Billing & Plans"
          description="Manage subscriptions, invoices, and payment methods."
          href="/portal/billing"
          icon={CreditCard}
        />
        <QuickLinkCard
          title="Usage & Limits"
          description="Monitor consumption and quota thresholds."
          href="/portal/usage"
          icon={Gauge}
        />
        <QuickLinkCard
          title="Users & Access"
          description="Invite team members and manage roles."
          href="/portal/users"
          icon={Users}
        />
        <QuickLinkCard
          title="Integrations"
          description="Configure webhooks and partner apps."
          href="/portal/integrations"
          icon={Plug}
        />
      </section>

      {/* Overall Utilization */}
      {usagePercentage > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Overall Utilization</CardTitle>
            <CardDescription>
              Combined signal from API calls and storage usage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                  {usagePercentage}%
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Projected monthly usage
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {usagePercentage > 85
                      ? "Approaching plan limits. Review plans to avoid throttling."
                      : "Within healthy range. Keep monitoring weekly trends."}
                  </p>
                </div>
              </div>
              <Button
                asChild
                variant={usagePercentage > 85 ? "destructive" : "outline"}
              >
                <Link href="/portal/billing">Review plan & limits</Link>
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
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface QuickLinkCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
}

function QuickLinkCard({
  title,
  description,
  href,
  icon: Icon,
}: QuickLinkCardProps) {
  return (
    <Card className="h-full border-border hover:border-primary/40 transition-colors">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <Button asChild variant="secondary" className="w-full justify-between">
          <Link href={href}>
            Open section
            <span aria-hidden>&rarr;</span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
