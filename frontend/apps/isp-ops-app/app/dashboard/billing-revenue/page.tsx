"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  DollarSign,
  CreditCard,
  FileText,
  Calendar,
  TrendingUp,
  ArrowUpRight,
  AlertCircle,
  Package,
  Receipt,
} from "lucide-react";
import { metricsService, BillingMetrics } from "@/lib/services/metrics-service";
import { AlertBanner } from "@/components/alerts/AlertBanner";
import { apiClient } from "@/lib/api/client";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { SkeletonMetricCard } from "@dotmac/ui";
import { Breadcrumb } from "@dotmac/ui";
import { MetricCardEnhanced } from "@dotmac/ui";
import { ErrorState } from "@dotmac/ui";
import { LineChart } from "@/components/charts/LineChart";
import { useDashboardMetrics } from "@/hooks/useRealTimeMetrics";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  href?: string;
  currency?: boolean;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  href,
  currency,
}: MetricCardProps) {
  const formattedValue =
    currency && typeof value === "number"
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(value)
      : value;

  const content = (
    <div className="rounded-lg border border-border bg-card p-6 hover:border-border transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formattedValue}</p>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          {trend && (
            <div
              className={`mt-2 flex items-center text-sm ${trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
            >
              <TrendingUp className={`h-4 w-4 mr-1 ${!trend.isPositive ? "rotate-180" : ""}`} />
              {Math.abs(trend.value)}% from last month
            </div>
          )}
        </div>
        <div className="p-3 bg-accent rounded-lg">
          <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block group relative">
        {content}
        <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    );
  }

  return content;
}

interface RevenueChartProps {
  data: Array<{
    month: string;
    revenue: number;
    subscriptions: number;
  }>;
}

function RevenueChart({ data }: RevenueChartProps) {
  const chartData = data.map((d) => ({
    label: d.month,
    value: d.revenue,
  }));

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Revenue Trend</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-600 dark:bg-blue-400"></div>
            <span>MRR</span>
          </div>
        </div>
      </div>
      <LineChart data={chartData} height={220} showGrid showLabels showValues animated gradient />
    </div>
  );
}

interface PaymentActivityItem {
  id: string;
  type: "payment" | "invoice" | "subscription" | "refund";
  description: string;
  amount: number;
  timestamp: string;
  status: "success" | "pending" | "failed";
}

function PaymentActivity({ items }: { items: PaymentActivityItem[] }) {
  const statusColors = {
    success: "text-green-600 dark:text-green-400",
    pending: "text-yellow-600 dark:text-yellow-400",
    failed: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Recent Transactions</h3>
      </div>
      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">No recent transactions</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="p-4 hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-accent rounded-lg">
                    <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{item.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.timestamp}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">${(item.amount / 100).toFixed(2)}</p>
                  <p className={`text-xs ${statusColors[item.status]}`}>{item.status}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BillingRevenuePageContent() {
  const [metrics, setMetrics] = useState<BillingMetrics | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<PaymentActivityItem[]>([]);
  const [revenueData, setRevenueData] = useState<
    Array<{ month: string; revenue: number; subscriptions: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingData();
    // Refresh metrics every 60 seconds
    const interval = setInterval(fetchBillingData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch billing metrics from the metrics service
      const billingMetrics = await metricsService.getBillingMetrics();
      setMetrics(billingMetrics);

      // Fetch recent transactions
      try {
        const transactionsResponse = await apiClient.get<{
          payments: Array<Record<string, unknown>>;
        }>("/billing/payments?limit=5");
        if (transactionsResponse.data?.payments) {
          const transactions: PaymentActivityItem[] = transactionsResponse.data.payments.map(
            (t, index: number) => ({
              id: (t["id"] as string) || `trans-${index}`,
              type: (t["type"] as "payment" | "invoice" | "subscription" | "refund") || "payment",
              description:
                (t["description"] as string) ||
                `Payment from ${(t["customer_name"] as string) || "Customer"}`,
              amount: (t["amount"] as number) || 0,
              timestamp: t["created_at"]
                ? new Date(t["created_at"] as string).toLocaleString()
                : "Recently",
              status: (t["status"] as "success" | "pending" | "failed") || "pending",
            }),
          );
          setRecentTransactions(transactions);
        }
      } catch (err) {
        console.error("Failed to fetch recent transactions:", err);
      }

      // Generate revenue trend data based on metrics
      if (billingMetrics.revenue.mrr > 0) {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
        const baseRevenue = billingMetrics.revenue.mrr;
        const growthRate = billingMetrics.revenue.revenueGrowth / 100;

        const data = months.map((month, index) => {
          const multiplier = 1 + (growthRate * (index - 3)) / 3;
          return {
            month,
            revenue: Math.round(baseRevenue * multiplier),
            subscriptions: billingMetrics.subscriptions.active + Math.round((index - 3) * 5),
          };
        });
        setRevenueData(data);
      }
    } catch (err) {
      console.error("Failed to fetch billing metrics:", err);
      setError(err instanceof Error ? err.message : "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Billing & Revenue" }]}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Billing & Revenue</h1>
        <p className="mt-2 text-sm md:text-base text-muted-foreground">
          Manage invoices, subscriptions, payments, and pricing plans
        </p>
      </div>

      {/* Alert Banner - Shows billing-related alerts */}
      <AlertBanner category="billing" maxAlerts={3} />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {loading ? (
          <>
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
          </>
        ) : error ? (
          <div className="col-span-full">
            <ErrorState message={error} onRetry={fetchBillingData} variant="card" />
          </div>
        ) : (
          <>
            <MetricCardEnhanced
              title="Monthly Recurring Revenue"
              value={metrics?.revenue.mrr || 0}
              subtitle="MRR"
              icon={DollarSign}
              trend={{
                value: metrics?.revenue.revenueGrowth || 0,
                isPositive: (metrics?.revenue.revenueGrowth || 0) > 0,
              }}
              currency
              emptyStateMessage="No revenue data available yet"
            />
            <MetricCardEnhanced
              title="Active Subscriptions"
              value={metrics?.subscriptions.active || 0}
              subtitle={`${metrics?.subscriptions.trial || 0} in trial`}
              icon={Package}
              trend={{
                value: Math.abs(metrics?.subscriptions.churnRate || 0),
                isPositive: (metrics?.subscriptions.churnRate || 0) < 5,
              }}
              href="/dashboard/billing-revenue/subscriptions"
              emptyStateMessage="No active subscriptions"
            />
            <MetricCardEnhanced
              title="Outstanding Invoices"
              value={metrics?.invoices.pending || 0}
              subtitle={`${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(metrics?.invoices.overdueAmount || 0)} overdue`}
              icon={FileText}
              href="/dashboard/billing-revenue/invoices"
              emptyStateMessage="No pending invoices"
            />
            <MetricCardEnhanced
              title="Payment Success Rate"
              value={`${metrics?.payments.successRate || 0}%`}
              subtitle={`${metrics?.payments.failed || 0} failed`}
              icon={CreditCard}
              emptyStateMessage="No payment data yet"
            />
          </>
        )}
      </div>

      {/* Overdue Invoices Alert */}
      {metrics?.invoices.overdue && metrics.invoices.overdue > 0 && (
        <div className="rounded-lg border border-orange-900/20 bg-orange-950/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-orange-400">Payment Attention Required</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {metrics.invoices.overdue} invoices are overdue totaling{" "}
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(metrics.invoices.overdueAmount || 0)}
                .
                <Link
                  href="/dashboard/billing-revenue/invoices?status=overdue"
                  className="ml-2 text-orange-400 hover:text-orange-300"
                >
                  View overdue invoices →
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue Chart */}
          <RevenueChart data={revenueData} />

          {/* Quick Links */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Billing Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/dashboard/billing-revenue/invoices"
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
              >
                <div className="p-2 bg-accent rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Invoices</p>
                  <p className="text-sm text-muted-foreground">View and manage invoices</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link
                href="/dashboard/billing-revenue/subscriptions"
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
              >
                <div className="p-2 bg-accent rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Subscriptions</p>
                  <p className="text-sm text-muted-foreground">Manage recurring billing</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link
                href="/dashboard/billing-revenue/payments"
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
              >
                <div className="p-2 bg-accent rounded-lg">
                  <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Payments</p>
                  <p className="text-sm text-muted-foreground">Process and track payments</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link
                href="/dashboard/billing-revenue/plans"
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
              >
                <div className="p-2 bg-accent rounded-lg">
                  <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Pricing Plans</p>
                  <p className="text-sm text-muted-foreground">Configure pricing tiers</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-1">
          <PaymentActivity items={recentTransactions} />
        </div>
      </div>
    </div>
  );
}

export default function BillingRevenuePage() {
  return (
    <RouteGuard permission="billing.read">
      <BillingRevenuePageContent />
    </RouteGuard>
  );
}
