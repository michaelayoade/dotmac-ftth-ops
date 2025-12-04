"use client";

import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  RotateCcw,
  XOctagon,
  Eye,
  Play,
  Pause,
} from "lucide-react";
import {
  useOrchestrationStats,
  useWorkflows,
  useWorkflow,
  useRetryWorkflow,
  useCancelWorkflow,
  type Workflow,
  type WorkflowStatus,
  type WorkflowType,
  type WorkflowStep,
} from "@/hooks/useOrchestration";

// ============================================================================
// Utility Functions
// ============================================================================

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return "N/A";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatWorkflowType(type: WorkflowType): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getStatusColor(status: WorkflowStatus): string {
  switch (status) {
    case "completed":
      return "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950";
    case "running":
      return "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950";
    case "failed":
      return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950";
    case "rolling_back":
    case "rolled_back":
      return "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950";
    case "pending":
      return "text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-950";
    default:
      return "text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-950";
  }
}

function getStatusIcon(status: WorkflowStatus) {
  switch (status) {
    case "completed":
      return CheckCircle2;
    case "running":
      return Loader2;
    case "failed":
      return XCircle;
    case "rolling_back":
    case "rolled_back":
      return RotateCcw;
    case "pending":
      return Clock;
    default:
      return Activity;
  }
}

// ============================================================================
// Statistics Cards Component
// ============================================================================

function StatsCard({ title, value, subtitle, icon: Icon, trend }: any) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          {trend !== undefined && (
            <div
              className={`mt-2 flex items-center text-sm ${trend >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
            >
              <TrendingUp className={`h-4 w-4 mr-1 ${trend < 0 ? "rotate-180" : ""}`} />
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Workflow Detail Modal Component
// ============================================================================

function WorkflowDetailModal({ workflowId, onClose }: { workflowId: string; onClose: () => void }) {
  const workflowQuery = useWorkflow(workflowId, true);
  const workflow = workflowQuery.data;
  const loading = workflowQuery.isLoading;

  if (loading || !workflow) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card rounded-lg p-8 max-w-4xl w-full mx-4">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  const StatusIcon = getStatusIcon(workflow.status);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-card rounded-lg p-6 max-w-5xl w-full mx-4 my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Workflow Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <XOctagon className="h-5 w-5" />
          </button>
        </div>

        {/* Workflow Header */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Workflow ID</p>
            <p className="font-mono text-sm mt-1">{workflow.workflow_id}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Type</p>
            <p className="font-medium mt-1">{formatWorkflowType(workflow.workflow_type)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(workflow.status)}`}
              >
                <StatusIcon
                  className={`h-3.5 w-3.5 ${workflow.status === "running" ? "animate-spin" : ""}`}
                />
                {workflow.status.toUpperCase()}
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Duration</p>
            <p className="font-medium mt-1">
              {formatDuration(workflow.started_at, workflow.completed_at || workflow.failed_at)}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {workflow.error_message && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900 dark:text-red-100">Error</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {workflow.error_message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Workflow Steps */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Workflow Steps</h3>
          <div className="space-y-3">
            {workflow.steps?.map((step: WorkflowStep, index: number) => {
              const StepIcon = getStatusIcon(step["status"] as any);
              return (
                <div
                  key={step.id}
                  className="flex items-start gap-4 p-4 border border-border rounded-lg"
                >
                  <div className="flex-shrink-0">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full ${getStatusColor(step["status"] as any)}`}
                    >
                      <StepIcon
                        className={`h-4 w-4 ${step.status === "running" ? "animate-spin" : ""}`}
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{step.step_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {step.target_system} • {step.step_type}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDuration(step.started_at, step.completed_at || step.failed_at)}
                      </div>
                    </div>
                    {step.error_message && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                        {step.error_message}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Input/Output Data */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">Input Data</h3>
            <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
              {JSON.stringify(workflow.input_data, null, 2)}
            </pre>
          </div>
          {workflow.output_data && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Output Data</h3>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(workflow.output_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Workflow List Component
// ============================================================================

function WorkflowList({
  workflows,
  loading,
  onViewDetails,
  onRetry,
  onCancel,
}: {
  workflows: Workflow[];
  loading: boolean;
  onViewDetails: (workflowId: string) => void;
  onRetry: (workflowId: string) => void;
  onCancel: (workflowId: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-foreground">No workflows found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Workflows will appear here once created
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workflows.map((workflow) => {
        const StatusIcon = getStatusIcon(workflow.status);
        return (
          <div
            key={workflow.id}
            className="flex items-center gap-4 p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
          >
            <div className="flex-shrink-0">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full ${getStatusColor(workflow.status)}`}
              >
                <StatusIcon
                  className={`h-5 w-5 ${workflow.status === "running" ? "animate-spin" : ""}`}
                />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">
                  {formatWorkflowType(workflow.workflow_type)}
                </p>
                <span className="text-xs text-muted-foreground">
                  #{workflow.workflow_id.slice(0, 8)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {workflow.started_at ? (
                  <>Started {new Date(workflow.started_at).toLocaleString()}</>
                ) : (
                  <>Created {new Date(workflow.created_at).toLocaleString()}</>
                )}
              </p>
            </div>

            <div className="flex-shrink-0 text-right">
              <p className="text-sm font-medium text-foreground">
                {formatDuration(workflow.started_at, workflow.completed_at || workflow.failed_at)}
              </p>
              {workflow.steps && (
                <p className="text-xs text-muted-foreground mt-1">
                  {workflow.steps.filter((s) => s.status === "completed").length}/
                  {workflow.steps.length} steps
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onViewDetails(workflow.workflow_id)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                title="View details"
              >
                <Eye className="h-4 w-4" />
              </button>
              {workflow.status === "failed" && (
                <button
                  onClick={() => onRetry(workflow.workflow_id)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors text-orange-600"
                  title="Retry workflow"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
              {workflow.status === "running" && (
                <button
                  onClick={() => onCancel(workflow.workflow_id)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors text-red-600"
                  title="Cancel workflow"
                >
                  <XOctagon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

export default function OrchestrationDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useOrchestrationStats();

  const {
    data: runningResponse,
    isLoading: runningLoading,
    refetch: refetchRunning,
  } = useWorkflows({
    status: "running",
    autoRefresh: autoRefresh,
    refreshInterval: 3000,
  });
  const runningWorkflows = runningResponse?.workflows ?? [];

  const {
    data: failedResponse,
    isLoading: failedLoading,
    refetch: refetchFailed,
  } = useWorkflows({
    status: "failed",
    pageSize: 10,
  });
  const failedWorkflows = failedResponse?.workflows ?? [];

  const { retryWorkflow } = useRetryWorkflow();
  const { cancelWorkflow } = useCancelWorkflow();

  const handleRetry = async (workflowId: string) => {
    const success = await retryWorkflow(workflowId);
    if (success) {
      refetchFailed();
      refetchStats();
    }
  };

  const handleCancel = async (workflowId: string) => {
    const success = await cancelWorkflow(workflowId);
    if (success) {
      refetchRunning();
      refetchStats();
    }
  };

  const handleRefreshAll = () => {
    refetchStats();
    refetchRunning();
    refetchFailed();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Orchestration Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Track multi-system workflow execution in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              autoRefresh
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            Auto-refresh
          </button>
          <button
            onClick={handleRefreshAll}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Workflows" value={stats?.total || 0} icon={Activity} />
        <StatsCard
          title="Running"
          value={stats?.running || 0}
          subtitle={`${stats?.pending || 0} pending`}
          icon={Loader2}
        />
        <StatsCard
          title="Completed"
          value={stats?.completed || 0}
          subtitle={
            stats?.success_rate ? `${stats.success_rate.toFixed(1)}% success rate` : undefined
          }
          icon={CheckCircle2}
        />
        <StatsCard
          title="Failed"
          value={stats?.failed || 0}
          subtitle={
            stats?.avg_duration_seconds
              ? `${stats.avg_duration_seconds.toFixed(1)}s avg`
              : undefined
          }
          icon={XCircle}
        />
      </div>

      {/* Active Workflows */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Active Workflows</h2>
          <span className="text-sm text-muted-foreground">{runningWorkflows.length} running</span>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <WorkflowList
            workflows={runningWorkflows}
            loading={runningLoading}
            onViewDetails={setSelectedWorkflowId}
            onRetry={handleRetry}
            onCancel={handleCancel}
          />
        </div>
      </div>

      {/* Failed Workflows */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Failed Workflows</h2>
          <span className="text-sm text-muted-foreground">{failedWorkflows.length} failed</span>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <WorkflowList
            workflows={failedWorkflows}
            loading={failedLoading}
            onViewDetails={setSelectedWorkflowId}
            onRetry={handleRetry}
            onCancel={handleCancel}
          />
        </div>
      </div>

      {/* Workflow Detail Modal */}
      {selectedWorkflowId && (
        <WorkflowDetailModal
          workflowId={selectedWorkflowId}
          onClose={() => setSelectedWorkflowId(null)}
        />
      )}
    </div>
  );
}
