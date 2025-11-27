"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  Activity,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Download,
  TrendingUp,
  AlertCircle,
  Info,
} from "lucide-react";
import { useAppConfig } from "@/providers/AppConfigContext";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";

interface DiagnosticRun {
  id: string;
  tenant_id: string;
  diagnostic_type: string;
  status: "pending" | "running" | "completed" | "failed" | "timeout";
  severity: "info" | "warning" | "error" | "critical" | null;
  subscriber_id: string | null;
  customer_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  success: boolean;
  summary: string | null;
  error_message: string | null;
  results: Record<string, any>;
  recommendations: Array<{ title: string; description: string; priority: string }>;
  created_at: string;
}

interface DiagnosticStats {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  avgDuration: number;
  successRate: number;
}

function DiagnosticsHistoryPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  // Fetch diagnostic runs
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;

  const {
    data: runsData,
    isLoading,
    refetch,
  } = useQuery<{ total: number; items: DiagnosticRun[] }>({
    queryKey: ["diagnostics-all", apiBaseUrl, typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("diagnostic_type", typeFilter);
      params.append("limit", "100");

      const response = await fetch(`${apiBaseUrl}/api/v1/diagnostics/runs?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch diagnostics");
      return response.json();
    },
  });

  const runs = runsData?.items || [];

  // Calculate stats
  const stats: DiagnosticStats = {
    total: runs.length,
    byStatus: runs.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    bySeverity: runs.reduce(
      (acc, r) => {
        if (r.severity) acc[r.severity] = (acc[r.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    byType: runs.reduce(
      (acc, r) => {
        acc[r.diagnostic_type] = (acc[r.diagnostic_type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    avgDuration:
      runs.length > 0
        ? Math.round(runs.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / runs.length)
        : 0,
    successRate:
      runs.length > 0 ? Math.round((runs.filter((r) => r.success).length / runs.length) * 100) : 0,
  };

  // Filter runs
  const filteredRuns = runs.filter((run) => {
    const matchesSearch =
      !searchQuery ||
      run.subscriber_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.diagnostic_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.summary?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || run.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || run.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { icon: Clock, color: "bg-gray-100 text-gray-800", label: "Pending" },
      running: { icon: RefreshCw, color: "bg-blue-100 text-blue-800", label: "Running" },
      completed: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Completed" },
      failed: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Failed" },
      timeout: { icon: AlertTriangle, color: "bg-amber-100 text-amber-800", label: "Timeout" },
    };
    const config = badges[status as keyof typeof badges] || badges.pending;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className={`h-3 w-3 mr-1 ${status === "running" ? "animate-spin" : ""}`} />
        {config.label}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string | null) => {
    if (!severity) return null;
    const badges = {
      info: { icon: Info, color: "bg-blue-100 text-blue-800", label: "Info" },
      warning: { icon: AlertTriangle, color: "bg-amber-100 text-amber-800", label: "Warning" },
      error: { icon: AlertCircle, color: "bg-red-100 text-red-800", label: "Error" },
      critical: { icon: XCircle, color: "bg-red-600 text-white", label: "Critical" },
    };
    const config = badges[severity as keyof typeof badges];
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const formatDiagnosticType = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const exportData = () => {
    const csv = [
      ["Time", "Type", "Subscriber", "Status", "Severity", "Duration", "Summary"].join(","),
      ...filteredRuns.map((run) =>
        [
          new Date(run.created_at).toISOString(),
          run.diagnostic_type,
          run.subscriber_id || "",
          run.status,
          run.severity || "",
          run.duration_ms || "",
          `"${run.summary?.replace(/"/g, '""') || ""}"`,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostics-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Diagnostic History</h1>
          <p className="text-sm text-muted-foreground">
            View and analyze all diagnostic runs across subscribers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Diagnostics</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.byStatus["completed"] || 0} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDuration}ms</div>
            <p className="text-xs text-muted-foreground">Per diagnostic</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.bySeverity["critical"] || 0}
            </div>
            <p className="text-xs text-muted-foreground">{stats.bySeverity["error"] || 0} errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="connectivity_check">Connectivity Check</SelectItem>
                <SelectItem value="radius_session">RADIUS Session</SelectItem>
                <SelectItem value="onu_status">ONU Status</SelectItem>
                <SelectItem value="cpe_status">CPE Status</SelectItem>
                <SelectItem value="ip_verification">IP Verification</SelectItem>
                <SelectItem value="health_check">Health Check</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="timeout">Timeout</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Diagnostic Runs ({filteredRuns.length})</CardTitle>
          <CardDescription>Recent diagnostic executions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading diagnostic history...
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No diagnostic runs found</div>
          ) : (
            <div className="space-y-3">
              {filteredRuns.map((run) => (
                <div key={run.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{formatDiagnosticType(run.diagnostic_type)}</h4>
                        {getStatusBadge(run.status)}
                        {getSeverityBadge(run.severity)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(run.created_at).toLocaleString()}</span>
                        {run.duration_ms && <span>• {run.duration_ms}ms</span>}
                        {run.subscriber_id && (
                          <>
                            <span>•</span>
                            <Link
                              href={`/dashboard/radius/subscribers/${run.subscriber_id}/diagnostics`}
                              className="text-primary hover:underline"
                            >
                              {run.subscriber_id}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {run.summary && <p className="text-sm">{run.summary}</p>}

                  {run.error_message && (
                    <p className="text-sm text-destructive">{run.error_message}</p>
                  )}

                  {run.recommendations.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium">Recommendations:</p>
                      {run.recommendations.slice(0, 2).map((rec, i) => (
                        <div key={i} className="text-xs p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                          <p className="font-medium">{rec.title}</p>
                          <p className="text-muted-foreground">{rec.description}</p>
                        </div>
                      ))}
                      {run.recommendations.length > 2 && (
                        <p className="text-xs text-muted-foreground">
                          +{run.recommendations.length - 2} more
                        </p>
                      )}
                    </div>
                  )}

                  {Object.keys(run.results).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs font-medium cursor-pointer">View Details</summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                        {JSON.stringify(run.results, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DiagnosticsHistoryPage() {
  return (
    <RouteGuard permission="diagnostics.read">
      <DiagnosticsHistoryPageContent />
    </RouteGuard>
  );
}
