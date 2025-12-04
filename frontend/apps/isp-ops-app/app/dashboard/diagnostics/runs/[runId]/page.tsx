"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useAppConfig } from "@/providers/AppConfigContext";
import {
  ArrowLeft,
  RefreshCw,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Copy,
  RotateCw,
  AlertOctagon,
  Info,
  User,
  FileText,
  Network,
} from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";

// Types
enum DiagnosticType {
  CONNECTIVITY_CHECK = "connectivity_check",
  PING_TEST = "ping_test",
  TRACEROUTE = "traceroute",
  RADIUS_SESSION = "radius_session",
  ONU_STATUS = "onu_status",
  CPE_STATUS = "cpe_status",
  IP_VERIFICATION = "ip_verification",
  BANDWIDTH_TEST = "bandwidth_test",
  LATENCY_TEST = "latency_test",
  PACKET_LOSS_TEST = "packet_loss_test",
  CPE_RESTART = "cpe_restart",
  ONU_REBOOT = "onu_reboot",
  HEALTH_CHECK = "health_check",
  SERVICE_PATH_TRACE = "service_path_trace",
}

enum DiagnosticStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  TIMEOUT = "timeout",
}

enum DiagnosticSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

interface DiagnosticRun {
  id: string;
  tenant_id: string;
  diagnostic_type: DiagnosticType;
  status: DiagnosticStatus;
  severity: DiagnosticSeverity | null;
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
  diagnostic_metadata: Record<string, any>;
  created_at: string;
}

const getStatusConfig = (status: DiagnosticStatus) => {
  const configs = {
    [DiagnosticStatus.PENDING]: {
      icon: Clock,
      color: "bg-yellow-100 text-yellow-800 border-yellow-200",
      label: "Pending",
      bannerColor: "bg-yellow-50 border-yellow-200",
    },
    [DiagnosticStatus.RUNNING]: {
      icon: Loader2,
      color: "bg-blue-100 text-blue-800 border-blue-200",
      label: "Running",
      bannerColor: "bg-blue-50 border-blue-200",
    },
    [DiagnosticStatus.COMPLETED]: {
      icon: CheckCircle,
      color: "bg-green-100 text-green-800 border-green-200",
      label: "Completed",
      bannerColor: "bg-green-50 border-green-200",
    },
    [DiagnosticStatus.FAILED]: {
      icon: XCircle,
      color: "bg-red-100 text-red-800 border-red-200",
      label: "Failed",
      bannerColor: "bg-red-50 border-red-200",
    },
    [DiagnosticStatus.TIMEOUT]: {
      icon: AlertCircle,
      color: "bg-orange-100 text-orange-800 border-orange-200",
      label: "Timeout",
      bannerColor: "bg-orange-50 border-orange-200",
    },
  };
  return configs[status] || configs[DiagnosticStatus.PENDING];
};

const getSeverityConfig = (severity: DiagnosticSeverity | null) => {
  if (!severity) return null;
  const configs = {
    [DiagnosticSeverity.INFO]: { icon: Info, color: "bg-blue-100 text-blue-800", label: "Info" },
    [DiagnosticSeverity.WARNING]: {
      icon: AlertTriangle,
      color: "bg-yellow-100 text-yellow-800",
      label: "Warning",
    },
    [DiagnosticSeverity.ERROR]: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Error" },
    [DiagnosticSeverity.CRITICAL]: {
      icon: AlertOctagon,
      color: "bg-red-600 text-white",
      label: "Critical",
    },
  };
  return configs[severity];
};

const formatDiagnosticType = (type: string) => {
  return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

function DiagnosticRunDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const runId = params["runId"] as string;
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";

  // Fetch diagnostic run details
  const { data: run, isLoading } = useQuery<DiagnosticRun>({
    queryKey: ["diagnostic-run", runId, apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/diagnostics/runs/${runId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch diagnostic run");
      return response.json();
    },
    refetchInterval: (query) => {
      // Auto-refresh every 5 seconds if status is pending or running
      return query?.state?.data &&
        (query.state.data.status === DiagnosticStatus.RUNNING ||
          query.state.data.status === DiagnosticStatus.PENDING)
        ? 5000
        : false;
    },
  });

  const handleCopyResults = () => {
    if (run?.results) {
      navigator.clipboard.writeText(JSON.stringify(run.results, null, 2));
      toast({ title: "Success", description: "Results copied to clipboard" });
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["diagnostic-run", runId] });
    toast({ title: "Refreshed", description: "Diagnostic run data has been refreshed" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Diagnostic run not found</p>
      </div>
    );
  }

  const statusConfig = getStatusConfig(run.status);
  const severityConfig = getSeverityConfig(run.severity);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/diagnostics/history">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Diagnostic Run</h1>
              <Badge className={statusConfig.color}>
                <StatusIcon
                  className={`h-3 w-3 mr-1 ${run.status === DiagnosticStatus.RUNNING ? "animate-spin" : ""}`}
                />
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {formatDiagnosticType(run.diagnostic_type)} - ID: {run.id.substring(0, 8)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`p-4 rounded-lg border ${statusConfig.bannerColor} flex items-start gap-3`}>
        <StatusIcon
          className={`h-5 w-5 mt-0.5 ${run.status === DiagnosticStatus.RUNNING ? "animate-spin" : ""}`}
        />
        <div className="flex-1">
          <div className="font-medium">
            {run.status === DiagnosticStatus.RUNNING && "Diagnostic is currently running..."}
            {run.status === DiagnosticStatus.PENDING && "Diagnostic is pending execution..."}
            {run.status === DiagnosticStatus.COMPLETED && "Diagnostic completed successfully"}
            {run.status === DiagnosticStatus.FAILED && "Diagnostic failed"}
            {run.status === DiagnosticStatus.TIMEOUT && "Diagnostic timed out"}
          </div>
          {run.summary && <p className="text-sm text-muted-foreground mt-1">{run.summary}</p>}
        </div>
        {severityConfig && (
          <Badge className={severityConfig.color}>
            {(() => {
              const SeverityIcon = severityConfig.icon;
              return <SeverityIcon className="h-3 w-3 mr-1" />;
            })()}
            {severityConfig.label}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="recommendations">
            Recommendations
            {run.recommendations.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {run.recommendations.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Diagnostic Details */}
            <Card>
              <CardHeader>
                <CardTitle>Diagnostic Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Diagnostic ID</div>
                  <div className="font-mono font-medium">{run.id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Type</div>
                  <div className="font-medium">{formatDiagnosticType(run.diagnostic_type)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge className={statusConfig.color}>
                    <StatusIcon
                      className={`h-3 w-3 mr-1 ${run.status === DiagnosticStatus.RUNNING ? "animate-spin" : ""}`}
                    />
                    {statusConfig.label}
                  </Badge>
                </div>
                {run.severity && (
                  <div>
                    <div className="text-sm text-muted-foreground">Severity</div>
                    {severityConfig && (
                      <Badge className={severityConfig.color}>
                        {(() => {
                          const SeverityIcon = severityConfig.icon;
                          return <SeverityIcon className="h-3 w-3 mr-1" />;
                        })()}
                        {severityConfig.label}
                      </Badge>
                    )}
                  </div>
                )}
                <div>
                  <div className="text-sm text-muted-foreground">Success</div>
                  <div className="font-medium">{run.success ? "Yes" : "No"}</div>
                </div>
              </CardContent>
            </Card>

            {/* Subscriber & Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle>Subscriber & Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {run.subscriber_id && (
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Subscriber ID
                    </div>
                    <div className="font-mono font-medium">
                      <Link
                        href={`/dashboard/diagnostics/subscriber/${run.subscriber_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {run.subscriber_id}
                      </Link>
                    </div>
                  </div>
                )}
                {run.customer_id && (
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer ID
                    </div>
                    <div className="font-mono font-medium">{run.customer_id}</div>
                  </div>
                )}
                {!run.subscriber_id && !run.customer_id && (
                  <div className="text-sm text-muted-foreground">
                    No subscriber or customer information
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Timing Information */}
          <Card>
            <CardHeader>
              <CardTitle>Timing Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Started At
                  </div>
                  {run.started_at ? (
                    <>
                      <div className="font-medium">{format(new Date(run.started_at), "PPp")}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                      </div>
                    </>
                  ) : (
                    <div className="font-medium">Not started</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Completed At
                  </div>
                  {run.completed_at ? (
                    <>
                      <div className="font-medium">{format(new Date(run.completed_at), "PPp")}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(run.completed_at), { addSuffix: true })}
                      </div>
                    </>
                  ) : (
                    <div className="font-medium">Not completed</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Duration
                  </div>
                  <div className="font-medium">
                    {run.duration_ms ? `${run.duration_ms}ms` : "N/A"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary & Error */}
          {(run.summary || run.error_message) && (
            <div className="grid gap-4 md:grid-cols-2">
              {run.summary && (
                <Card>
                  <CardHeader>
                    <CardTitle>Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{run.summary}</p>
                  </CardContent>
                </Card>
              )}
              {run.error_message && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-red-600">Error Message</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-destructive">{run.error_message}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Diagnostic Results</CardTitle>
                <Button variant="outline" size="sm" onClick={handleCopyResults}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {Object.keys(run.results).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No results available</div>
              ) : (
                <div className="space-y-4">
                  {/* Key Metrics (if available) */}
                  {(run.results["signal_level"] ||
                    run.results["session_count"] ||
                    run.results["latency"] ||
                    run.results["packet_loss"]) && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                      {run.results["signal_level"] && (
                        <div className="p-3 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Signal Level</div>
                          <div className="text-2xl font-bold">{run.results["signal_level"]}</div>
                        </div>
                      )}
                      {run.results["session_count"] !== undefined && (
                        <div className="p-3 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Sessions</div>
                          <div className="text-2xl font-bold">{run.results["session_count"]}</div>
                        </div>
                      )}
                      {run.results["latency"] && (
                        <div className="p-3 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Latency</div>
                          <div className="text-2xl font-bold">{run.results["latency"]}ms</div>
                        </div>
                      )}
                      {run.results["packet_loss"] !== undefined && (
                        <div className="p-3 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Packet Loss</div>
                          <div className="text-2xl font-bold">{run.results["packet_loss"]}%</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Full JSON Results */}
                  <div>
                    <div className="text-sm font-medium mb-2">Full Results</div>
                    <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto max-h-96 border">
                      {JSON.stringify(run.results, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              {run.recommendations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recommendations available
                </div>
              ) : (
                <div className="space-y-3">
                  {run.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{rec.title}</h4>
                            <Badge
                              variant={
                                rec.priority === "high" || rec.priority === "critical"
                                  ? "destructive"
                                  : rec.priority === "medium"
                                    ? "default"
                                    : "secondary"
                              }
                            >
                              {rec.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{rec.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      {run.subscriber_id && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href={`/dashboard/diagnostics/subscriber/${run.subscriber_id}`}>
                  <Network className="h-4 w-4 mr-2" />
                  View Subscriber Diagnostics
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DiagnosticRunDetailsPage() {
  return (
    <RouteGuard permission="isp.diagnostics.read">
      <DiagnosticRunDetailsContent />
    </RouteGuard>
  );
}
