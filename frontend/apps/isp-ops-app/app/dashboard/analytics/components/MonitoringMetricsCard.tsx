"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { LineChart } from "@/components/charts/LineChart";
import { useMonitoringMetrics } from "@/lib/graphql/hooks";
import { Activity, AlertTriangle, Clock, Users } from "lucide-react";
import { Skeleton } from "@dotmac/ui";

export function MonitoringMetricsCard({ period: _period = "24h" }: { period?: string }) {
  const { data, isLoading, error } = useMonitoringMetrics();

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
            Failed to load monitoring metrics: {(error as Error).message}
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
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Error rate: {formatPercent(metrics.errorRate)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgResponseTimeMs.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">
              P95: {metrics.p95ResponseTimeMs.toFixed(0)}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              Uptime: {formatPercent(metrics.systemUptime)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.criticalErrors}</div>
            <p className="text-xs text-muted-foreground">{metrics.warningCount} warnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests Chart */}
      {metrics.requestsTimeSeries && metrics.requestsTimeSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Request Volume</CardTitle>
            <CardDescription>API requests over time</CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              data={metrics.requestsTimeSeries.map((ts) => ({
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

      {/* Response Time Chart */}
      {metrics.responseTimeTimeSeries && metrics.responseTimeTimeSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Response Time Trend</CardTitle>
            <CardDescription>Average response time in milliseconds</CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              data={metrics.responseTimeTimeSeries.map((ts) => ({
                label: ts.label,
                value: ts.value,
              }))}
              height={250}
              showGrid
              showValues
            />
          </CardContent>
        </Card>
      )}

      {/* Error Rate Chart */}
      {metrics.errorRateTimeSeries && metrics.errorRateTimeSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Error Rate</CardTitle>
            <CardDescription>Percentage of failed requests</CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              data={metrics.errorRateTimeSeries.map((ts) => ({
                label: ts.label,
                value: ts.value * 100, // Convert to percentage
              }))}
              height={250}
              showGrid
              showValues
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
