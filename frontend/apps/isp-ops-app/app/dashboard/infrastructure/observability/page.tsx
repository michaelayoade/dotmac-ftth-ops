"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  Eye,
  Database,
  Network,
  Server,
  Loader2,
  Timer,
  GitBranch,
  Clock,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTraces, useMetrics, useServiceMap, usePerformance } from "@/hooks/useObservability";

export default function ObservabilityPage() {
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedService, setSelectedService] = useState("all");

  // Use real API hooks
  const traceFilters = useMemo(
    () => (selectedService !== "all" ? { service: selectedService } : {}),
    [selectedService],
  );
  const { traces, isLoading: tracesLoading, refetch: refetchTraces } = useTraces(traceFilters);
  const { metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useMetrics();
  const { serviceMap, isLoading: serviceMapLoading, refetch: refetchServiceMap } = useServiceMap();
  const {
    performance,
    isLoading: performanceLoading,
    refetch: refetchPerformance,
  } = usePerformance();

  const isRefreshing = tracesLoading || metricsLoading || serviceMapLoading || performanceLoading;

  const handleRefresh = () => {
    refetchTraces();
    refetchMetrics();
    refetchServiceMap();
    refetchPerformance();
  };

  const handleExport = () => {
    const exportData = {
      traces,
      metrics,
      serviceMap,
      performance,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `observability-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="default" className="bg-green-500">
            Success
          </Badge>
        );
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "warning":
        return <Badge variant="secondary">Warning</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Transform metrics for charts
  const metricsHistory =
    metrics && metrics.length > 0 && metrics[0]?.data_points
      ? metrics[0].data_points.map((dp, index) => ({
          time: new Date(dp.timestamp).toLocaleTimeString(),
          requests:
            metrics.find((m) => m.name === "request_count")?.data_points?.[index]?.value || 0,
          errors: metrics.find((m) => m.name === "error_count")?.data_points?.[index]?.value || 0,
          latency: metrics.find((m) => m.name === "latency_ms")?.data_points?.[index]?.value || 0,
        }))
      : [];

  // Calculate current metrics from data
  const totalRequests =
    metrics
      .find((m) => m.name === "request_count")
      ?.data_points?.reduce((sum, dp) => sum + dp.value, 0) || 0;
  const totalErrors =
    metrics
      .find((m) => m.name === "error_count")
      ?.data_points?.reduce((sum, dp) => sum + dp.value, 0) || 0;
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  const latencyMetric = metrics.find((m) => m.name === "latency_ms");
  const latencySum = latencyMetric?.data_points?.reduce((sum, dp) => sum + dp.value, 0) ?? 0;
  const latencyCount = latencyMetric?.data_points?.length ?? 1;
  const avgLatency = latencySum / latencyCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Observability</h1>
          <p className="text-muted-foreground mt-2">
            Monitor traces, metrics, and system performance
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="h-10 w-[120px] rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleRefresh} disabled={isRefreshing} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : totalRequests >= 1000000 ? (
                `${(totalRequests / 1000000).toFixed(1)}M`
              ) : totalRequests >= 1000 ? (
                `${(totalRequests / 1000).toFixed(1)}K`
              ) : (
                totalRequests
              )}
            </div>
            <p className="text-xs text-muted-foreground">{timeRange}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                `${errorRate.toFixed(2)}%`
              )}
            </div>
            <p className="text-xs text-muted-foreground">{totalErrors} errors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                `${avgLatency.toFixed(0)}ms`
              )}
            </div>
            <p className="text-xs text-muted-foreground">Average response time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Traces</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tracesLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : traces.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {serviceMap?.services.length || 0} services
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="traces">
        <TabsList>
          <TabsTrigger value="traces">Distributed Traces</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="dependencies">Service Map</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Traces Tab */}
        <TabsContent value="traces" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Recent Traces</CardTitle>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="h-10 w-[200px] rounded-md border border-border bg-card px-3 text-sm text-foreground"
                >
                  <option value="all">All Services</option>
                  {serviceMap?.services.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {tracesLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading traces...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {traces.slice(0, 10).map((trace) => (
                    <div key={trace.trace_id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3">
                          {getStatusIcon(trace.status)}
                          <div>
                            <div className="font-semibold">{trace.operation}</div>
                            <div className="text-sm text-muted-foreground">
                              Service: {trace.service} • Trace ID: {trace.trace_id}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span className="flex items-center gap-1">
                                <Timer className="h-3 w-3" />
                                {trace.duration}ms
                              </span>
                              <span className="flex items-center gap-1">
                                <GitBranch className="h-3 w-3" />
                                {trace.spans} spans
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(trace.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(trace.status)}
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                        </div>
                      </div>
                      {/* Trace Timeline */}
                      <div className="mt-4">
                        <div className="text-xs text-muted-foreground mb-2">Trace Timeline</div>
                        <div className="h-8 bg-muted rounded relative overflow-hidden">
                          <div
                            className={`h-full ${
                              trace.status === "success"
                                ? "bg-green-400 dark:bg-green-600"
                                : trace.status === "error"
                                  ? "bg-red-400 dark:bg-red-600"
                                  : "bg-yellow-400 dark:bg-yellow-600"
                            }`}
                            style={{
                              width: `${Math.min((trace.duration / 2000) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Request Volume</CardTitle>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={metricsHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="requests"
                        stroke="#3b82f6"
                        fill="#93c5fd"
                        fillOpacity={0.6}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Latency Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metricsHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="latency"
                        stroke="#10b981"
                        name="Avg Latency (ms)"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="errors"
                        stroke="#ef4444"
                        name="Errors"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Service Health Score</CardTitle>
              </CardHeader>
              <CardContent>
                {serviceMapLoading ? (
                  <div className="flex items-center justify-center h-[200px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {serviceMap?.services.map((service) => {
                      const healthScore = serviceMap.health_scores[service] || 0;
                      return (
                        <div key={service}>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">{service}</span>
                            <span className="text-sm font-medium">{healthScore.toFixed(0)}%</span>
                          </div>
                          <Progress value={healthScore} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Dependencies Tab */}
        <TabsContent value="dependencies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Dependency Map</CardTitle>
              <CardDescription>Visualize service interactions and dependencies</CardDescription>
            </CardHeader>
            <CardContent>
              {serviceMapLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium">Total Services</span>
                          </div>
                          <span className="text-2xl font-bold">
                            {serviceMap?.services.length || 0}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Network className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="text-sm font-medium">Active Connections</span>
                          </div>
                          <span className="text-2xl font-bold">
                            {serviceMap?.dependencies.length || 0}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span className="text-sm font-medium">Avg Error Rate</span>
                          </div>
                          <span className="text-2xl font-bold">
                            {(
                              ((serviceMap?.dependencies.reduce(
                                (sum, d) => sum + d.error_rate,
                                0,
                              ) || 0) /
                                (serviceMap?.dependencies.length || 1)) *
                              100
                            ).toFixed(2)}
                            %
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-3">
                    {serviceMap?.dependencies.map((dep, idx) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">
                              {dep.from_service} → {dep.to_service}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {dep.request_count.toLocaleString()} requests •{" "}
                              {dep.avg_latency.toFixed(1)}ms avg latency
                            </div>
                          </div>
                          <Badge variant={dep.error_rate > 0.05 ? "destructive" : "outline"}>
                            {(dep.error_rate * 100).toFixed(2)}% errors
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Percentiles</CardTitle>
              <CardDescription>Response time percentiles compared to SLA targets</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performance?.percentiles || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="percentile" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#3b82f6" name="Actual" />
                    <Bar dataKey="target" fill="hsl(var(--muted))" name="Target" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Slowest Endpoints</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {performance?.slowest_endpoints.map((endpoint, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-sm">{endpoint.endpoint}</span>
                      <Badge variant={endpoint.avg_latency > 2000 ? "destructive" : "secondary"}>
                        {endpoint.avg_latency}ms
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Most Frequent Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {performance?.most_frequent_errors.map((error, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-sm">{error.error_type}</span>
                      <Badge variant="secondary">
                        {error.status_code} ({error.count})
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
