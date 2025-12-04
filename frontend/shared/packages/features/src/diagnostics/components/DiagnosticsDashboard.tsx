/**
 * Diagnostics Dashboard Component
 *
 * Provides comprehensive network diagnostics and troubleshooting tools.
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";
import {
  Activity,
  Wifi,
  Key,
  Radio,
  Router,
  Globe,
  RotateCw,
  Play,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { useState } from "react";

import {
  DiagnosticRun,
  DiagnosticType,
  DiagnosticStatus,
  DiagnosticSeverity,
  DIAGNOSTIC_TOOLS,
} from "../types";

// ============================================================================
// Types
// ============================================================================

export interface DiagnosticsApiClient {
  get: <T = any>(url: string) => Promise<{ data: T }>;
  post: <T = any>(url: string, data?: any) => Promise<{ data: T }>;
}

export interface ToastHook {
  toast: (options: {
    title: string;
    description: string;
    variant?: "default" | "destructive";
  }) => void;
}

export interface DiagnosticsLogger {
  error: (message: string, ...args: any[]) => void;
}

export interface DiagnosticsDashboardProps {
  subscriberId: string;
  hasONU?: boolean;
  hasCPE?: boolean;
  apiClient: DiagnosticsApiClient;
  useToast: () => ToastHook;
  logger: DiagnosticsLogger;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getStatusIcon = (status: DiagnosticStatus) => {
  switch (status) {
    case DiagnosticStatus.COMPLETED:
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case DiagnosticStatus.FAILED:
      return <XCircle className="w-4 h-4 text-red-500" />;
    case DiagnosticStatus.RUNNING:
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case DiagnosticStatus.PENDING:
      return <Clock className="w-4 h-4 text-gray-400" />;
    default:
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
  }
};

const getSeverityBadge = (severity?: DiagnosticSeverity) => {
  if (!severity) return null;

  switch (severity) {
    case DiagnosticSeverity.CRITICAL:
      return <Badge variant="destructive">Critical</Badge>;
    case DiagnosticSeverity.ERROR:
      return <Badge variant="destructive">Error</Badge>;
    case DiagnosticSeverity.WARNING:
      return <Badge variant="secondary">Warning</Badge>;
    case DiagnosticSeverity.INFO:
      return <Badge variant="outline">Info</Badge>;
  }
};

const getToolIcon = (iconName: string) => {
  const icons: Record<string, any> = {
    Wifi,
    Key,
    Radio,
    Router,
    Globe,
    RotateCw,
    Activity,
  };
  const Icon = icons[iconName] || Activity;
  return <Icon className="w-5 h-5" />;
};

// ============================================================================
// Component
// ============================================================================

export function DiagnosticsDashboard({
  subscriberId,
  hasONU = false,
  hasCPE = false,
  apiClient,
  useToast,
  logger,
}: DiagnosticsDashboardProps) {
  const { toast } = useToast();

  const [runningChecks, setRunningChecks] = useState<Set<DiagnosticType>>(new Set());
  const [results, setResults] = useState<Map<DiagnosticType, DiagnosticRun>>(new Map());

  const runDiagnostic = async (diagnosticType: DiagnosticType) => {
    setRunningChecks((prev) => new Set(prev).add(diagnosticType));

    try {
      let endpoint = "";
      let method: "get" | "post" = "get";

      switch (diagnosticType) {
        case DiagnosticType.CONNECTIVITY_CHECK:
          endpoint = `/api/isp/v1/admin/diagnostics/subscribers/${subscriberId}/connectivity`;
          method = "post";
          break;
        case DiagnosticType.RADIUS_SESSION:
          endpoint = `/api/isp/v1/admin/diagnostics/subscribers/${subscriberId}/radius-sessions`;
          break;
        case DiagnosticType.ONU_STATUS:
          endpoint = `/api/isp/v1/admin/diagnostics/subscribers/${subscriberId}/onu-status`;
          break;
        case DiagnosticType.CPE_STATUS:
          endpoint = `/api/isp/v1/admin/diagnostics/subscribers/${subscriberId}/cpe-status`;
          break;
        case DiagnosticType.IP_VERIFICATION:
          endpoint = `/api/isp/v1/admin/diagnostics/subscribers/${subscriberId}/ip-verification`;
          break;
        case DiagnosticType.CPE_RESTART:
          endpoint = `/api/isp/v1/admin/diagnostics/subscribers/${subscriberId}/restart-cpe`;
          method = "post";
          break;
        case DiagnosticType.HEALTH_CHECK:
          endpoint = `/api/isp/v1/admin/diagnostics/subscribers/${subscriberId}/health-check`;
          break;
      }

      const response = await (method === "post"
        ? apiClient.post<DiagnosticRun>(endpoint)
        : apiClient.get<DiagnosticRun>(endpoint));

      const diagnostic = response.data;

      setResults((prev) => new Map(prev).set(diagnosticType, diagnostic));

      if (diagnostic.success) {
        toast({
          title: "Diagnostic completed",
          description: diagnostic.summary || "Check completed successfully",
        });
      } else {
        toast({
          title: "Issues found",
          description: diagnostic.summary || "Diagnostic completed with issues",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err.message || "Diagnostic failed";
      logger.error("Diagnostic failed", err);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setRunningChecks((prev) => {
        const next = new Set(prev);
        next.delete(diagnosticType);
        return next;
      });
    }
  };

  const tools = DIAGNOSTIC_TOOLS.filter((tool) => {
    if (tool.requiresONU && !hasONU) return false;
    if (tool.requiresCPE && !hasCPE) return false;
    return true;
  });

  const categorizedTools = {
    check: tools.filter((t) => t.category === "check"),
    action: tools.filter((t) => t.category === "action"),
    comprehensive: tools.filter((t) => t.category === "comprehensive"),
  };

  return (
    <div className="space-y-6">
      {/* Diagnostic Tools Grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Diagnostic Checks</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categorizedTools.check.map((tool) => {
            const isRunning = runningChecks.has(tool.type);
            const result = results.get(tool.type);

            return (
              <Card key={tool.type} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getToolIcon(tool.icon)}
                      <CardTitle className="text-base">{tool.name}</CardTitle>
                    </div>
                    {result && getStatusIcon(result.status)}
                  </div>
                  <CardDescription className="text-sm">{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {result && (
                      <div className="text-sm space-y-1">
                        {result.summary && <p className="text-gray-600">{result.summary}</p>}
                        {result.severity && <div>{getSeverityBadge(result.severity)}</div>}
                      </div>
                    )}
                    <Button
                      onClick={() => runDiagnostic(tool.type)}
                      disabled={isRunning}
                      size="sm"
                      className="w-full"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Run Check
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      {categorizedTools.action.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categorizedTools.action.map((tool) => {
              const isRunning = runningChecks.has(tool.type);
              const result = results.get(tool.type);

              return (
                <Card key={tool.type}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      {getToolIcon(tool.icon)}
                      <CardTitle className="text-base">{tool.name}</CardTitle>
                    </div>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {result && result.recommendations && result.recommendations.length > 0 && (
                      <Alert className="mb-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Action initiated</AlertTitle>
                        <AlertDescription>{result.recommendations[0]?.message}</AlertDescription>
                      </Alert>
                    )}
                    <Button
                      onClick={() => runDiagnostic(tool.type)}
                      disabled={isRunning}
                      variant="destructive"
                      size="sm"
                      className="w-full"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          {getToolIcon(tool.icon)}
                          <span className="ml-2">Execute</span>
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Comprehensive Check */}
      {categorizedTools.comprehensive.map((tool) => {
        const isRunning = runningChecks.has(tool.type);
        const result = results.get(tool.type);
        const healthCheck = result?.results as any;

        return (
          <Card key={tool.type} className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-6 h-6" />
                  <div>
                    <CardTitle>{tool.name}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </div>
                </div>
                {result && <div className="text-right">{getSeverityBadge(result.severity)}</div>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {healthCheck && (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {healthCheck.checks_passed || 0}
                    </div>
                    <div className="text-sm text-gray-600">Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {healthCheck.checks_failed || 0}
                    </div>
                    <div className="text-sm text-gray-600">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-400">
                      {healthCheck.checks_skipped || 0}
                    </div>
                    <div className="text-sm text-gray-600">Skipped</div>
                  </div>
                </div>
              )}

              {result?.recommendations && result.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Recommendations:</h4>
                  {result.recommendations.map((rec, idx) => (
                    <Alert
                      key={idx}
                      variant={
                        rec.severity === "critical" || rec.severity === "error"
                          ? "destructive"
                          : "default"
                      }
                    >
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{rec.message}</AlertTitle>
                      <AlertDescription>{rec.action}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              <Button
                onClick={() => runDiagnostic(tool.type)}
                disabled={isRunning}
                size="lg"
                className="w-full"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Running comprehensive check...
                  </>
                ) : (
                  <>
                    <Activity className="w-5 h-5 mr-2" />
                    Run Complete Health Check
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
