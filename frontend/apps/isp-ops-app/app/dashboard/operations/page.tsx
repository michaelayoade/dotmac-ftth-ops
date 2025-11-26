"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import {
  Users,
  Mail,
  FileText,
  Activity,
  TrendingUp,
  ArrowUpRight,
  AlertCircle,
  Clock,
  Package,
  RefreshCw,
} from "lucide-react";
import { useCustomerListGraphQL, useCustomerMetricsGraphQL } from "@/hooks/useCustomersGraphQL";
import { AlertBanner } from "@/components/alerts/AlertBanner";
import { MetricCardEnhanced } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";

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
}

function MetricCard({ title, value, subtitle, icon: Icon, trend, href }: MetricCardProps) {
  const content = (
    <div className="rounded-lg border border-border bg-card p-6 hover:border-border transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
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
        <div className="p-3 bg-muted rounded-lg">
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

interface QuickActionProps {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
}

function QuickAction({ title, description, href, icon: Icon }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
    >
      <div className="p-2 bg-muted rounded-lg">
        <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

interface RecentActivityItem {
  id: string;
  type: "customer" | "communication" | "file";
  title: string;
  description: string;
  timestamp: string;
  icon: React.ElementType;
}

function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
      </div>
      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">No recent activity</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="p-4 hover:bg-muted transition-colors">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <item.icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground truncate">{item.description}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {item.timestamp}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function OperationsPageContent() {
  // Fetch customer metrics using GraphQL
  const {
    metrics: customerMetrics,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics,
  } = useCustomerMetricsGraphQL({
    pollInterval: 60000, // Refresh every 60 seconds
  });

  // Fetch recent customers for activity
  const {
    customers: recentCustomers,
    isLoading: customersLoading,
    refetch: refetchCustomers,
  } = useCustomerListGraphQL({
    limit: 5,
    pollInterval: 60000,
  });

  // Transform customer data into recent activity
  const recentActivity: RecentActivityItem[] = [];

  // Add customer activity from metrics
  if (customerMetrics?.newCustomers) {
    recentActivity.push({
      id: "cust-new",
      type: "customer",
      title: `${customerMetrics.newCustomers} new customers`,
      description: "Registered this month",
      timestamp: "This month",
      icon: Users,
    });
  }

  // Add recent customer activity
  recentCustomers.forEach((customer: any, idx: number) => {
    if (idx < 3) {
      recentActivity.push({
        id: `cust-${customer.id}`,
        type: "customer",
        title: customer.displayName || "Unknown Customer",
        description: customer.email || "",
        timestamp: "Recent",
        icon: Users,
      });
    }
  });

  const loading = metricsLoading || customersLoading;

  const handleRefresh = () => {
    refetchMetrics();
    refetchCustomers();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Operations</h1>
          <p className="mt-2 text-muted-foreground">
            Manage customer lifecycle, communications, and file distribution
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Alert Banner - Shows operations-related alerts */}
      <AlertBanner category="system" maxAlerts={3} />

      {/* Error State */}
      {metricsError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load operations metrics. Please try refreshing.
          </p>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCardEnhanced
          title="Total Customers"
          value={customerMetrics?.totalCustomers || 0}
          subtitle="Active accounts"
          icon={Users}
          trend={{
            value: 5.2,
            isPositive: true,
          }}
          href="/dashboard/operations/customers"
          emptyStateMessage="No customers registered yet"
        />
        <MetricCardEnhanced
          title="Active Customers"
          value={customerMetrics?.activeCustomers || 0}
          subtitle={`${customerMetrics?.newCustomers || 0} new this month`}
          icon={Activity}
          trend={{
            value: 92.5,
            isPositive: true,
          }}
          href="/dashboard/operations/communications"
          emptyStateMessage="No communications sent"
        />
        <MetricCardEnhanced
          title="Churn Rate"
          value={`${(7.5).toFixed(1)}%`}
          subtitle="Last 30 days"
          icon={TrendingUp}
          trend={{
            value: 7.5,
            isPositive: false,
          }}
          emptyStateMessage="No churn data"
        />
        <MetricCardEnhanced
          title="Retention Rate"
          value={`${(92.5).toFixed(1)}%`}
          subtitle="Last 30 days"
          icon={Users}
          trend={{
            value: 92.5,
            isPositive: true,
          }}
          emptyStateMessage="No retention data"
        />
      </div>

      {/* Churn Risk Alert */}
      {customerMetrics?.churnedCustomers && customerMetrics.churnedCustomers > 0 && (
        <div className="rounded-lg border border-orange-900/20 bg-orange-950/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-orange-400">Attention Required</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {customerMetrics.churnedCustomers} customers churned recently.
                <Link
                  href="/dashboard/operations/customers"
                  className="ml-2 text-orange-400 hover:text-orange-300"
                >
                  View customers →
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <QuickAction
                title="Add New Customer"
                description="Register a new customer account"
                href="/dashboard/operations/customers?action=new"
                icon={Users}
              />
              <QuickAction
                title="Send Communication"
                description="Create email or notification"
                href="/dashboard/operations/communications?action=new"
                icon={Mail}
              />
              <QuickAction
                title="Upload Files"
                description="Distribute files to customers"
                href="/dashboard/operations/files?action=upload"
                icon={FileText}
              />
              <QuickAction
                title="View Reports"
                description="Analytics and insights"
                href="/dashboard/operations/reports"
                icon={Activity}
              />
            </div>
          </div>

          {/* Domain Overview */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Domain Overview</h2>
            <div className="space-y-4">
              <Link
                href="/dashboard/operations/customers"
                className="block rounded-lg border border-border bg-card p-6 hover:border-border transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Customer Management</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {customerMetrics?.totalCustomers || 0} total customers •{" "}
                        {customerMetrics?.newCustomers || 0} new this month
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Link>

              <Link
                href="/dashboard/operations/communications"
                className="block rounded-lg border border-border bg-card p-6 hover:border-border transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Communications</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Email, SMS, and notification management
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Link>

              <Link
                href="/dashboard/operations/files"
                className="block rounded-lg border border-border bg-card p-6 hover:border-border transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">File Distribution</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Manage and distribute files to customers
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <RecentActivity items={recentActivity} />
        </div>
      </div>
    </div>
  );
}

export default function OperationsPage() {
  return (
    <RouteGuard permission="operations.read">
      <OperationsPageContent />
    </RouteGuard>
  );
}
