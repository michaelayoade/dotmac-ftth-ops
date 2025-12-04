"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
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
  Wifi,
  Server,
  Router as RouterIcon,
  Network,
  Power,
  AlertOctagon,
  Info,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

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

const getStatusBadge = (status: DiagnosticStatus) => {
  const badges = {
    [DiagnosticStatus.PENDING]: {
      icon: Clock,
      color: "bg-yellow-100 text-yellow-800",
      label: "Pending",
    },
    [DiagnosticStatus.RUNNING]: {
      icon: Loader2,
      color: "bg-blue-100 text-blue-800",
      label: "Running",
    },
    [DiagnosticStatus.COMPLETED]: {
      icon: CheckCircle,
      color: "bg-green-100 text-green-800",
      label: "Completed",
    },
    [DiagnosticStatus.FAILED]: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Failed" },
    [DiagnosticStatus.TIMEOUT]: {
      icon: AlertCircle,
      color: "bg-orange-100 text-orange-800",
      label: "Timeout",
    },
  };
  const config = badges[status] || badges[DiagnosticStatus.PENDING];
  const Icon = config.icon;
  return (
    <Badge className={config.color}>
      <Icon
        className={`h-3 w-3 mr-1 ${status === DiagnosticStatus.RUNNING ? "animate-spin" : ""}`}
      />
      {config.label}
    </Badge>
  );
};

const getSeverityBadge = (severity: DiagnosticSeverity | null) => {
  if (!severity) return null;
  const badges = {
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
  const config = badges[severity];
  if (!config) return null;
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

function SubscriberDiagnosticsContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const subscriberId = params["subscriberId"] as string;
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";

  const [isRestartDialogOpen, setIsRestartDialogOpen] = useState(false);
  const [latestRunId, setLatestRunId] = useState<string | null>(null);

  // Fetch recent runs for this subscriber
  const { data: runsData, isLoading: runsLoading } = useQuery<{
    total: number;
    items: DiagnosticRun[];
  }>({
    queryKey: ["diagnostics-runs", subscriberId, apiBaseUrl],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("subscriber_id", subscriberId);
      params.append("limit", "10");

      const response = await fetch(`${apiBaseUrl}/api/v1/diagnostics/runs?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch diagnostic runs");
      return response.json();
    },
    refetchInterval: (query) => {
      // Auto-refresh every 5 seconds if any diagnostic is running
      const hasRunning = query?.state?.data?.items?.some(
        (run) => run.status === DiagnosticStatus.RUNNING || run.status === DiagnosticStatus.PENDING,
      );
      return hasRunning ? 5000 : false;
    },
  });

  // Fetch the latest diagnostic run details
  const { data: latestRun } = useQuery<DiagnosticRun>({
    queryKey: ["diagnostic-run", latestRunId, apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/diagnostics/runs/${latestRunId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch diagnostic run");
      return response.json();
    },
    enabled: !!latestRunId,
    refetchInterval: (query) => {
      // Auto-refresh every 5 seconds if diagnostic is running or pending
      return query?.state?.data &&
        (query.state.data.status === DiagnosticStatus.RUNNING ||
          query.state.data.status === DiagnosticStatus.PENDING)
        ? 5000
        : false;
    },
  });

  // Update latestRunId when runs data changes
  useEffect(() => {
    if (runsData?.items && runsData.items.length > 0) {
      setLatestRunId(runsData.items[0]?.id ?? null);
    }
  }, [runsData]);

  // Run connectivity check mutation
  const runConnectivityCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/diagnostics/subscribers/${subscriberId}/connectivity`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!response.ok) throw new Error("Failed to run connectivity check");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["diagnostics-runs", subscriberId] });
      setLatestRunId(data.id);
      toast({ title: "Success", description: "Connectivity check started" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to run connectivity check",
        variant: "destructive",
      });
    },
  });

  // Get RADIUS sessions mutation
  const getRadiusSessionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/diagnostics/subscribers/${subscriberId}/radius-sessions`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to get RADIUS sessions");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["diagnostics-runs", subscriberId] });
      setLatestRunId(data.id);
      toast({ title: "Success", description: "RADIUS sessions retrieved" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to get RADIUS sessions",
        variant: "destructive",
      });
    },
  });

  // Get ONU status mutation
  const getOnuStatusMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/diagnostics/subscribers/${subscriberId}/onu-status`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to get ONU status");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["diagnostics-runs", subscriberId] });
      setLatestRunId(data.id);
      toast({ title: "Success", description: "ONU status retrieved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to get ONU status", variant: "destructive" });
    },
  });

  // Get CPE status mutation
  const getCpeStatusMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/diagnostics/subscribers/${subscriberId}/cpe-status`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to get CPE status");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["diagnostics-runs", subscriberId] });
      setLatestRunId(data.id);
      toast({ title: "Success", description: "CPE status retrieved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to get CPE status", variant: "destructive" });
    },
  });

  // Get IP verification mutation
  const getIpVerificationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/diagnostics/subscribers/${subscriberId}/ip-verification`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to verify IP");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["diagnostics-runs", subscriberId] });
      setLatestRunId(data.id);
      toast({ title: "Success", description: "IP verification completed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to verify IP", variant: "destructive" });
    },
  });

  // Restart CPE mutation
  const restartCpeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/diagnostics/subscribers/${subscriberId}/restart-cpe`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!response.ok) throw new Error("Failed to restart CPE");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["diagnostics-runs", subscriberId] });
      setLatestRunId(data.id);
      setIsRestartDialogOpen(false);
      toast({ title: "Success", description: "CPE restart initiated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to restart CPE", variant: "destructive" });
    },
  });

  // Health check mutation
  const runHealthCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/diagnostics/subscribers/${subscriberId}/health-check`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to run health check");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["diagnostics-runs", subscriberId] });
      setLatestRunId(data.id);
      toast({ title: "Success", description: "Health check started" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run health check", variant: "destructive" });
    },
  });

  const runs = runsData?.items || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/diagnostics">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Subscriber Diagnostics</h1>
            <p className="text-sm text-muted-foreground">
              Subscriber ID: <span className="font-mono">{subscriberId}</span>
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["diagnostics-runs", subscriberId] })
          }
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Run diagnostics for this subscriber</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="outline"
              className="h-auto flex flex-col items-start p-4 gap-2"
              onClick={() => runConnectivityCheckMutation.mutate()}
              disabled={runConnectivityCheckMutation.isPending}
            >
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                <span className="font-medium">Connectivity Check</span>
              </div>
              <span className="text-xs text-muted-foreground">Test full connectivity</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex flex-col items-start p-4 gap-2"
              onClick={() => getRadiusSessionsMutation.mutate()}
              disabled={getRadiusSessionsMutation.isPending}
            >
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="font-medium">RADIUS Sessions</span>
              </div>
              <span className="text-xs text-muted-foreground">Check active sessions</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex flex-col items-start p-4 gap-2"
              onClick={() => getOnuStatusMutation.mutate()}
              disabled={getOnuStatusMutation.isPending}
            >
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                <span className="font-medium">ONU Status</span>
              </div>
              <span className="text-xs text-muted-foreground">Check ONU device</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex flex-col items-start p-4 gap-2"
              onClick={() => getCpeStatusMutation.mutate()}
              disabled={getCpeStatusMutation.isPending}
            >
              <div className="flex items-center gap-2">
                <RouterIcon className="h-4 w-4" />
                <span className="font-medium">CPE Status</span>
              </div>
              <span className="text-xs text-muted-foreground">Check CPE device</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex flex-col items-start p-4 gap-2"
              onClick={() => getIpVerificationMutation.mutate()}
              disabled={getIpVerificationMutation.isPending}
            >
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                <span className="font-medium">IP Verification</span>
              </div>
              <span className="text-xs text-muted-foreground">Verify IP allocation</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex flex-col items-start p-4 gap-2 border-orange-200 hover:bg-orange-50"
              onClick={() => setIsRestartDialogOpen(true)}
            >
              <div className="flex items-center gap-2">
                <Power className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-orange-600">Restart CPE</span>
              </div>
              <span className="text-xs text-muted-foreground">Reboot customer device</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex flex-col items-start p-4 gap-2"
              onClick={() => runHealthCheckMutation.mutate()}
              disabled={runHealthCheckMutation.isPending}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Health Check</span>
              </div>
              <span className="text-xs text-muted-foreground">Comprehensive check</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Results Section */}
      {latestRun && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Latest Diagnostic Result</CardTitle>
              <div className="flex items-center gap-2">
                {getStatusBadge(latestRun.status)}
                {getSeverityBadge(latestRun.severity)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm text-muted-foreground">Type</div>
                <div className="font-medium">{formatDiagnosticType(latestRun.diagnostic_type)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Duration</div>
                <div className="font-medium">
                  {latestRun.duration_ms ? `${latestRun.duration_ms}ms` : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Started</div>
                <div className="font-medium">
                  {latestRun.started_at ? format(new Date(latestRun.started_at), "PPp") : "N/A"}
                </div>
              </div>
            </div>

            {latestRun.summary && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Summary</div>
                <p className="text-sm">{latestRun.summary}</p>
              </div>
            )}

            {latestRun.error_message && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Error</div>
                <p className="text-sm text-destructive">{latestRun.error_message}</p>
              </div>
            )}

            {latestRun.recommendations.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Recommendations</div>
                <div className="space-y-2">
                  {latestRun.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{rec.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {rec.priority}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(latestRun.results).length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Results</div>
                <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-64">
                  {JSON.stringify(latestRun.results, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/diagnostics/runs/${latestRun.id}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Full Details
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Runs Section */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Diagnostic Runs</CardTitle>
          <CardDescription>Last 10 diagnostic executions for this subscriber</CardDescription>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No diagnostic runs found for this subscriber
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      {formatDiagnosticType(run.diagnostic_type)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(run.status)}
                        {getSeverityBadge(run.severity)}
                      </div>
                    </TableCell>
                    <TableCell>{run.duration_ms ? `${run.duration_ms}ms` : "N/A"}</TableCell>
                    <TableCell>{format(new Date(run.created_at), "PPp")}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/diagnostics/runs/${run.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Restart CPE Confirmation Dialog */}
      <Dialog open={isRestartDialogOpen} onOpenChange={setIsRestartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restart CPE Device</DialogTitle>
            <DialogDescription>
              This will restart the customer&apos;s CPE device, which may cause a temporary service
              interruption. Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRestartDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => restartCpeMutation.mutate()}
              disabled={restartCpeMutation.isPending}
            >
              {restartCpeMutation.isPending ? "Restarting..." : "Restart CPE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SubscriberDiagnosticsPage() {
  return (
    <RouteGuard permission="isp.diagnostics.read">
      <SubscriberDiagnosticsContent />
    </RouteGuard>
  );
}
