"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { useCustomerMetrics } from "@/lib/graphql/hooks";
import { Users, UserPlus, UserMinus, TrendingUp } from "lucide-react";
import { Skeleton } from "@dotmac/ui";

export function CustomerMetricsCard({ period = "30d" }: { period?: string }) {
  const { data, isLoading, error } = useCustomerMetrics(period);

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
          <p className="text-destructive">
            Failed to load customer metrics: {(error as Error).message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const metrics = data;

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

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
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">{metrics.activeCustomers} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.newCustomers}</div>
            <p className="text-xs text-muted-foreground">
              Growth: {formatPercent(metrics.customerGrowthRate)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <UserMinus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(metrics.churnRate)}</div>
            <p className="text-xs text-muted-foreground">{metrics.churnedCustomers} churned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.averageLifetimeValue)}</div>
            <p className="text-xs text-muted-foreground">
              Retention: {formatPercent(metrics.retentionRate)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Growth Chart */}
      {metrics.customerTimeSeries && metrics.customerTimeSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Growth</CardTitle>
            <CardDescription>Total customers over time</CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              data={metrics.customerTimeSeries.map((ts) => ({
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

      {/* Churn Chart */}
      {metrics.churnTimeSeries && metrics.churnTimeSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Churn</CardTitle>
            <CardDescription>Churned customers over time</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              data={metrics.churnTimeSeries.map((ts) => ({
                label: ts.label,
                value: ts.value,
              }))}
              height={250}
              showValues
              colorScheme="purple"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
