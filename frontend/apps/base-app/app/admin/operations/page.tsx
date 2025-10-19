"use client";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  RefreshCw,
  Server,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useMonitoringMetrics,
  useLogStats,
  useSystemHealth,
  getStatusColor,
  getStatusIcon,
  getHealthStatusText,
  calculateSuccessRate,
  formatPercentage,
  formatDuration,
  getSeverityColor,
  type ServiceHealth,
} from "@/hooks/useOperations";

export default function OperationsPage() {
  const [metricsPeriod, setMetricsPeriod] = useState<'1h' | '24h' | '7d'>('24h');
  const [logsPeriod, setLogsPeriod] = useState<'1h' | '24h' | '7d'>('24h');

  // Query hooks
  const { data: metrics, isLoading: loadingMetrics, error: metricsError, refetch: refetchMetrics } = useMonitoringMetrics(metricsPeriod);
  const { data: logStats, isLoading: loadingLogs, error: logsError, refetch: refetchLogs } = useLogStats(logsPeriod);
  const { data: health, isLoading: loadingHealth, error: healthError, refetch: refetchHealth } = useSystemHealth();

  const serviceChecks: Array<[string, ServiceHealth]> = health
    ? (Object.entries(health.checks) as Array<[string, ServiceHealth | undefined]>).filter(
        (entry): entry is [string, ServiceHealth] => Boolean(entry[1])
      )
    : [];
  const topErrors = metrics?.top_errors ?? [];
  const commonErrors = logStats?.most_common_errors ?? [];

  const isLoading = loadingMetrics || loadingLogs || loadingHealth;
  const error = metricsError || logsError || healthError;

  const handleRefreshAll = () => {
    refetchMetrics();
    refetchLogs();
    refetchHealth();
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operations</p>
            <h1 className="text-3xl font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-8 w-8 text-primary" />
              System Monitoring
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time system health, performance metrics, and operational insights
            </p>
          </div>
          <Button onClick={handleRefreshAll} disabled={isLoading} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load monitoring data: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && !health && !metrics && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading monitoring data...</span>
        </div>
      )}

      {/* System Health Overview */}
      {health && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              System Health
            </CardTitle>
            <CardDescription>{getHealthStatusText(health.status)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {serviceChecks.map(([serviceName, check]) => (
                <div
                  key={serviceName}
                  className={`rounded-lg border px-4 py-3 ${getStatusColor(check.status)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold capitalize">{check.name}</span>
                    <span className="text-xl">{getStatusIcon(check.status)}</span>
                  </div>
                  <p className="text-xs opacity-80">{check.message}</p>
                  {check.required && (
                    <Badge variant="outline" className="mt-2 text-xs">Required</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      {metrics && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Performance Metrics</h2>
            <div className="flex items-center gap-2">
              <Button
                variant={metricsPeriod === '1h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMetricsPeriod('1h')}
              >
                1H
              </Button>
              <Button
                variant={metricsPeriod === '24h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMetricsPeriod('24h')}
              >
                24H
              </Button>
              <Button
                variant={metricsPeriod === '7d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMetricsPeriod('7d')}
              >
                7D
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Requests */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.total_requests.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPercentage(calculateSuccessRate(metrics.successful_requests, metrics.total_requests))} success rate
                </p>
              </CardContent>
            </Card>

            {/* Error Rate */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Error Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercentage(metrics.error_rate)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.critical_errors} critical errors
                </p>
              </CardContent>
            </Card>

            {/* Avg Response Time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Avg Response Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(metrics.avg_response_time_ms)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  P95: {formatDuration(metrics.p95_response_time_ms)}
                </p>
              </CardContent>
            </Card>

            {/* High Latency */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  High Latency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.high_latency_requests}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Requests &gt;1s
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Activity Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Activity Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">API Requests</span>
                    <span className="font-semibold">{metrics.api_requests.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{
                        width: `${(metrics.api_requests / metrics.total_requests) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">User Activities</span>
                    <span className="font-semibold">{metrics.user_activities.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${(metrics.user_activities / metrics.total_requests) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">System Activities</span>
                    <span className="font-semibold">{metrics.system_activities.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500"
                      style={{
                        width: `${(metrics.system_activities / metrics.total_requests) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Errors */}
          {topErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Top Errors
                </CardTitle>
                <CardDescription>Most common error types in the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topErrors.slice(0, 10).map((error, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{error.error_type}</p>
                        <p className="text-xs text-muted-foreground">
                          Last seen: {new Date(error.last_seen).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="destructive">{error.count} occurrences</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Log Statistics */}
      {logStats && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Log Statistics</h2>
            <div className="flex items-center gap-2">
              <Button
                variant={logsPeriod === '1h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLogsPeriod('1h')}
              >
                1H
              </Button>
              <Button
                variant={logsPeriod === '24h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLogsPeriod('24h')}
              >
                24H
              </Button>
              <Button
                variant={logsPeriod === '7d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLogsPeriod('7d')}
              >
                7D
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Logs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  Total Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{logStats.total_logs.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {logStats.unique_users} unique users
                </p>
              </CardContent>
            </Card>

            {/* Critical Logs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-400" />
                  Critical Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">{logStats.critical_logs.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {logStats.high_logs} high severity
                </p>
              </CardContent>
            </Card>

            {/* Error Logs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Error Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{logStats.error_logs.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {logStats.unique_error_types} unique types
                </p>
              </CardContent>
            </Card>

            {/* Auth Logs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Auth Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{logStats.auth_logs.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Authentication events
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Most Common Errors */}
          {commonErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Most Common Errors
                </CardTitle>
                <CardDescription>Error patterns identified in logs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {commonErrors.slice(0, 10).map((error, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{error.error_type}</p>
                        <p className={`text-xs ${getSeverityColor(error.severity)}`}>
                          Severity: {error.severity}
                        </p>
                      </div>
                      <Badge variant="outline">{error.count} occurrences</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
