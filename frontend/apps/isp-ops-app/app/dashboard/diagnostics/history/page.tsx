"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useAppConfig } from "@/providers/AppConfigContext";
import {
  Activity,
  Search,
  RefreshCw,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Eye,
  Info,
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
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

interface DiagnosticStats {
  total: number;
  running: number;
  successRate: number;
  avgDuration: number;
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

function DiagnosticHistoryContent() {
  const [subscriberIdFilter, setSubscriberIdFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");

  const limit = 50;
  const offset = currentPage * limit;

  // Fetch diagnostic runs with filters
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;

  const { data: runsData, isLoading } = useQuery<{ total: number; items: DiagnosticRun[] }>({
    queryKey: [
      "diagnostics-history",
      apiBaseUrl,
      subscriberIdFilter,
      typeFilter,
      statusFilter,
      offset,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (subscriberIdFilter) params.append("subscriber_id", subscriberIdFilter);
      if (typeFilter !== "all") params.append("diagnostic_type", typeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      params.append("limit", limit.toString());
      params.append("offset", offset.toString());

      const response = await fetch(`${apiBaseUrl}/api/v1/diagnostics/runs?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch diagnostic runs");
      return response.json();
    },
    refetchInterval: 15000, // Auto-refresh every 15 seconds
  });

  const runs = runsData?.items || [];
  const total = runsData?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Calculate statistics
  const stats: DiagnosticStats = {
    total: runs.length,
    running: runs.filter(
      (r) => r.status === DiagnosticStatus.RUNNING || r.status === DiagnosticStatus.PENDING,
    ).length,
    successRate:
      runs.length > 0 ? Math.round((runs.filter((r) => r.success).length / runs.length) * 100) : 0,
    avgDuration:
      runs.length > 0
        ? Math.round(runs.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / runs.length)
        : 0,
  };

  const handleSearch = () => {
    setSubscriberIdFilter(searchInput);
    setCurrentPage(0);
  };

  const handleClearFilters = () => {
    setSubscriberIdFilter("");
    setTypeFilter("all");
    setStatusFilter("all");
    setSearchInput("");
    setCurrentPage(0);
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
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground">All diagnostic runs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Running Count</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.running}</div>
            <p className="text-xs text-muted-foreground">Currently running or pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground">Successful completions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDuration}ms</div>
            <p className="text-xs text-muted-foreground">Per diagnostic run</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Subscriber ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                className="pl-10"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value={DiagnosticType.CONNECTIVITY_CHECK}>
                  Connectivity Check
                </SelectItem>
                <SelectItem value={DiagnosticType.RADIUS_SESSION}>RADIUS Session</SelectItem>
                <SelectItem value={DiagnosticType.ONU_STATUS}>ONU Status</SelectItem>
                <SelectItem value={DiagnosticType.CPE_STATUS}>CPE Status</SelectItem>
                <SelectItem value={DiagnosticType.IP_VERIFICATION}>IP Verification</SelectItem>
                <SelectItem value={DiagnosticType.HEALTH_CHECK}>Health Check</SelectItem>
                <SelectItem value={DiagnosticType.CPE_RESTART}>CPE Restart</SelectItem>
                <SelectItem value={DiagnosticType.PING_TEST}>Ping Test</SelectItem>
                <SelectItem value={DiagnosticType.TRACEROUTE}>Traceroute</SelectItem>
                <SelectItem value={DiagnosticType.BANDWIDTH_TEST}>Bandwidth Test</SelectItem>
                <SelectItem value={DiagnosticType.LATENCY_TEST}>Latency Test</SelectItem>
                <SelectItem value={DiagnosticType.PACKET_LOSS_TEST}>Packet Loss Test</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value={DiagnosticStatus.PENDING}>Pending</SelectItem>
                <SelectItem value={DiagnosticStatus.RUNNING}>Running</SelectItem>
                <SelectItem value={DiagnosticStatus.COMPLETED}>Completed</SelectItem>
                <SelectItem value={DiagnosticStatus.FAILED}>Failed</SelectItem>
                <SelectItem value={DiagnosticStatus.TIMEOUT}>Timeout</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Diagnostic Runs ({total})</CardTitle>
              <CardDescription>Recent diagnostic executions</CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {totalPages || 1}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No diagnostic runs found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Subscriber ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="font-mono text-xs">
                          {run.id.substring(0, 8)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatDiagnosticType(run.diagnostic_type)}
                        </TableCell>
                        <TableCell>
                          {run.subscriber_id ? (
                            <Link
                              href={`/dashboard/diagnostics/subscriber/${run.subscriber_id}`}
                              className="font-mono text-xs text-blue-600 hover:underline"
                            >
                              {run.subscriber_id}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(run.status)}</TableCell>
                        <TableCell>{getSeverityBadge(run.severity)}</TableCell>
                        <TableCell>{run.duration_ms ? `${run.duration_ms}ms` : "N/A"}</TableCell>
                        <TableCell>
                          <div className="text-sm">{format(new Date(run.created_at), "PPp")}</div>
                        </TableCell>
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
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} results
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="text-sm">
                    Page {currentPage + 1} of {totalPages || 1}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DiagnosticHistoryPage() {
  return (
    <RouteGuard permission="isp.diagnostics.read">
      <DiagnosticHistoryContent />
    </RouteGuard>
  );
}
