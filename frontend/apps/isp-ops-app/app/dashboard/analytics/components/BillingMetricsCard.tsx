"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { useBillingMetrics } from "@/lib/graphql/hooks";
import { DollarSign, TrendingUp, FileText, AlertCircle } from "lucide-react";
import { Skeleton } from "@dotmac/ui";

export function BillingMetricsCard({ period = "30d" }: { period?: string }) {
  const { data, isLoading, error } = useBillingMetrics(period);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[120px] mb-1" />
              <Skeleton className="h-3 w-[80px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Failed to load billing metrics: {(error as Error).message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const metrics = data;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.mrr)}</div>
            <p className="text-xs text-muted-foreground">ARR: {formatCurrency(metrics.arr)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              Total revenue: {formatCurrency(metrics.totalRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalInvoices}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.paidInvoices} paid, {metrics.overdueInvoices} overdue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.outstandingBalance)}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      {metrics.revenueTimeSeries && metrics.revenueTimeSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>Daily revenue for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              data={metrics.revenueTimeSeries.map((ts) => ({
                label: ts.label,
                value: ts.value,
              }))}
              height={250}
              showGrid
              showValues
              gradient
            />
          </CardContent>
        </Card>
      )}

      {/* Subscriptions Chart */}
      {metrics.subscriptionsTimeSeries && metrics.subscriptionsTimeSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription Growth</CardTitle>
            <CardDescription>Active subscriptions over time</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              data={metrics.subscriptionsTimeSeries.map((ts) => ({
                label: ts.label,
                value: ts.value,
              }))}
              height={250}
              showValues
              colorScheme="green"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
