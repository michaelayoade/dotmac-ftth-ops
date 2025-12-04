"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  ArrowLeft,
  Activity,
  Wifi,
  Router as RouterIcon,
  Network,
  RefreshCw,
  Play,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
  Info,
  AlertCircle,
  Server,
} from "lucide-react";
import { useApiConfig } from "@/hooks/useApiConfig";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";

interface DiagnosticRun {
  id: string;
  tenant_id: string;
  diagnostic_type: string;
  status: "pending" | "running" | "completed" | "failed" | "timeout";
  severity: "info" | "warning" | "error" | "critical" | null;
  subscriber_id: string;
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

function DiagnosticsPageContent() {
  const params = useParams();
  const subscriberId = params["subscriberId"] as string;
  const [activeTab, setActiveTab] = useState<"checks" | "history">("checks");
  const [runningChecks, setRunningChecks] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { apiBaseUrl } = useApiConfig();

  // Fetch latest diagnostic runs
  const { data: latestRuns = [], refetch: refetchRuns } = useQuery<DiagnosticRun[]>({
    queryKey: ["diagnostics", subscriberId],
    queryFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/diagnostics/runs?subscriber_id=${subscriberId}&limit=10`,
        { credentials: "include" },
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data.items || [];
    },
  });

  // Health check mutation
  const healthCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/diagnostics/subscribers/${subscriberId}/health-check`,
        {
          method: "GET",
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Health check failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diagnostics", subscriberId] });
      toast({ title: "Health check completed" });
    },
    onError: (error: Error) => {
      toast({
        title: "Health check failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Individual check mutations
  const useCreateCheckMutation = (endpoint: string, checkName: string) =>
    useMutation({
      mutationFn: async () => {
        setRunningChecks((prev) => new Set([...prev, checkName]));
        const method = endpoint.includes("restart") ? "POST" : "GET";
        const response = await fetch(
          `${apiBaseUrl}/api/v1/diagnostics/subscribers/${subscriberId}/${endpoint}`,
          {
            method,
            credentials: "include",
          },
        );
        if (!response.ok) throw new Error(`${checkName} failed`);
        return response.json();
      },
      onSuccess: () => {
        setRunningChecks((prev) => {
          const next = new Set(prev);
          next.delete(checkName);
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ["diagnostics", subscriberId] });
        toast({ title: `${checkName} completed` });
        refetchRuns();
      },
      onError: (error: Error) => {
        setRunningChecks((prev) => {
          const next = new Set(prev);
          next.delete(checkName);
          return next;
        });
        toast({
          title: `${checkName} failed`,
          description: error.message,
          variant: "destructive",
        });
      },
    });

  const connectivityCheck = useCreateCheckMutation("connectivity", "Connectivity Check");
  const radiusSessionCheck = useCreateCheckMutation("radius-sessions", "RADIUS Session Check");
  const onuStatusCheck = useCreateCheckMutation("onu-status", "ONU Status Check");
  const cpeStatusCheck = useCreateCheckMutation("cpe-status", "CPE Status Check");
  const ipVerificationCheck = useCreateCheckMutation("ip-verification", "IP Verification");
  const cpeRestartCheck = useCreateCheckMutation("restart-cpe", "CPE Restart");

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
      info: { color: "bg-blue-100 text-blue-800", label: "Info" },
      warning: { color: "bg-amber-100 text-amber-800", label: "Warning" },
      error: { color: "bg-red-100 text-red-800", label: "Error" },
      critical: { color: "bg-red-600 text-white", label: "Critical" },
    };
    const config = badges[severity as keyof typeof badges];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const diagnosticChecks = [
    {
      id: "connectivity",
      title: "Connectivity Check",
      description: "Check overall connectivity including RADIUS auth and IP allocation",
      icon: Network,
      mutation: connectivityCheck,
      color: "text-blue-600",
    },
    {
      id: "radius-sessions",
      title: "RADIUS Sessions",
      description: "View active RADIUS authentication sessions",
      icon: Server,
      mutation: radiusSessionCheck,
      color: "text-purple-600",
    },
    {
      id: "onu-status",
      title: "ONU Status",
      description: "Check ONU optical signal level and operational status",
      icon: Zap,
      mutation: onuStatusCheck,
      color: "text-green-600",
    },
    {
      id: "cpe-status",
      title: "CPE Status",
      description: "Check CPE online status and firmware version",
      icon: RouterIcon,
      mutation: cpeStatusCheck,
      color: "text-orange-600",
    },
    {
      id: "ip-verification",
      title: "IP Verification",
      description: "Verify IP allocation consistency with NetBox IPAM",
      icon: Network,
      mutation: ipVerificationCheck,
      color: "text-cyan-600",
    },
  ];

  const latestByType = diagnosticChecks.reduce(
    (acc, check) => {
      const run = latestRuns.find((r) =>
        r.diagnostic_type.toLowerCase().includes(check.id.replace("-", "_")),
      );
      if (run) acc[check.id] = run;
      return acc;
    },
    {} as Record<string, DiagnosticRun>,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/radius/subscribers/${subscriberId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Subscriber Diagnostics</h1>
            <p className="text-sm text-muted-foreground">
              Network diagnostics for subscriber {subscriberId}
            </p>
          </div>
        </div>
        <Button
          onClick={() => healthCheckMutation.mutate()}
          disabled={healthCheckMutation.isPending}
          size="lg"
        >
          <Activity
            className={`h-4 w-4 mr-2 ${healthCheckMutation.isPending ? "animate-pulse" : ""}`}
          />
          Run Health Check
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "checks" | "history")}>
        <TabsList>
          <TabsTrigger value="checks">Diagnostic Checks</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Checks Tab */}
        <TabsContent value="checks" className="space-y-6">
          {/* Quick Actions */}
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                onClick={() => cpeRestartCheck.mutate()}
                disabled={cpeRestartCheck.isPending || runningChecks.has("CPE Restart")}
                className="w-full justify-start"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${cpeRestartCheck.isPending ? "animate-spin" : ""}`}
                />
                Restart CPE Device
              </Button>
              <p className="text-xs text-muted-foreground">
                This will trigger a reboot of the subscriber&apos;s CPE device via TR-069
              </p>
            </CardContent>
          </Card>

          {/* Diagnostic Checks Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {diagnosticChecks.map((check) => {
              const Icon = check.icon;
              const latestRun = latestByType[check.id];
              const isRunning = runningChecks.has(check.title);

              return (
                <Card key={check.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Icon className={`h-8 w-8 ${check.color}`} />
                      {latestRun && (
                        <div className="flex flex-col gap-1 items-end">
                          {getStatusBadge(latestRun.status)}
                          {getSeverityBadge(latestRun.severity)}
                        </div>
                      )}
                    </div>
                    <CardTitle className="mt-2">{check.title}</CardTitle>
                    <CardDescription>{check.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {latestRun && (
                      <div className="text-xs space-y-1">
                        <p className="text-muted-foreground">
                          Last run: {new Date(latestRun.created_at).toLocaleString()}
                        </p>
                        {latestRun.duration_ms && (
                          <p className="text-muted-foreground">
                            Duration: {latestRun.duration_ms}ms
                          </p>
                        )}
                        {latestRun.summary && (
                          <p className="font-medium mt-2">{latestRun.summary}</p>
                        )}
                      </div>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => check.mutation.mutate()}
                      disabled={check.mutation.isPending || isRunning}
                      className="w-full"
                    >
                      <Play className={`h-3 w-3 mr-2 ${isRunning ? "animate-pulse" : ""}`} />
                      Run Check
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Diagnostic History</CardTitle>
                  <CardDescription>Recent diagnostic runs for this subscriber</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchRuns()}>
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {latestRuns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No diagnostic runs found
                </div>
              ) : (
                <div className="space-y-3">
                  {latestRuns.map((run) => (
                    <div key={run.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">
                              {run.diagnostic_type
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </h4>
                            {getStatusBadge(run.status)}
                            {getSeverityBadge(run.severity)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(run.created_at).toLocaleString()}
                            {run.duration_ms && ` • ${run.duration_ms}ms`}
                          </p>
                        </div>
                      </div>

                      {run.summary && <p className="text-sm">{run.summary}</p>}

                      {run.error_message && (
                        <p className="text-sm text-destructive">{run.error_message}</p>
                      )}

                      {run.recommendations.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-medium">Recommendations:</p>
                          {run.recommendations.map((rec, i) => (
                            <div
                              key={i}
                              className="text-xs p-2 bg-blue-50 dark:bg-blue-950/20 rounded"
                            >
                              <p className="font-medium">{rec.title}</p>
                              <p className="text-muted-foreground">{rec.description}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {Object.keys(run.results).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs font-medium cursor-pointer">
                            View Details
                          </summary>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DiagnosticsPage() {
  return (
    <RouteGuard permission="radius.read">
      <DiagnosticsPageContent />
    </RouteGuard>
  );
}
