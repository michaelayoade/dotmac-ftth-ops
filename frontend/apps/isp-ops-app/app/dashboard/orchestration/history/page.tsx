"use client";

import { useState, useMemo } from "react";
import {
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Activity,
  Eye,
  Trash2,
} from "lucide-react";
import {
  useWorkflows,
  useWorkflow,
  type WorkflowStatus,
  type WorkflowType,
  type Workflow,
} from "@/hooks/useOrchestration";
import { apiClient } from "@/lib/api/client";
import { useConfirmDialog } from "@dotmac/ui";

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
      return RefreshCw;
    default:
      return Clock;
  }
}

// ============================================================================
// Filter Panel Component
// ============================================================================

interface FilterPanelProps {
  statusFilter: WorkflowStatus | "all";
  typeFilter: WorkflowType | "all";
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
  onStatusChange: (status: WorkflowStatus | "all") => void;
  onTypeChange: (type: WorkflowType | "all") => void;
  onSearchChange: (query: string) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onClearFilters: () => void;
}

function FilterPanel({
  statusFilter,
  typeFilter,
  searchQuery,
  dateFrom,
  dateTo,
  onStatusChange,
  onTypeChange,
  onSearchChange,
  onDateFromChange,
  onDateToChange,
  onClearFilters,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const workflowTypes: (WorkflowType | "all")[] = [
    "all",
    "provision_subscriber",
    "deprovision_subscriber",
    "activate_service",
    "suspend_service",
    "terminate_service",
    "change_service_plan",
  ];

  const statuses: (WorkflowStatus | "all")[] = [
    "all",
    "completed",
    "failed",
    "running",
    "pending",
    "rolled_back",
  ];

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-foreground font-medium"
        >
          <Filter className="h-5 w-5" />
          Filters
          {(statusFilter !== "all" ||
            typeFilter !== "all" ||
            searchQuery ||
            dateFrom ||
            dateTo) && (
            <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
              Active
            </span>
          )}
        </button>
        <button
          onClick={onClearFilters}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear all
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Search */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Search Workflow ID
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search by workflow ID..."
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value as WorkflowStatus | "all")}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All Statuses" : status.replace("_", " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Workflow Type</label>
            <select
              value={typeFilter}
              onChange={(e) => onTypeChange(e.target.value as WorkflowType | "all")}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {workflowTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "all" ? "All Types" : formatWorkflowType(type)}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Workflow Table Component
// ============================================================================

function WorkflowTable({
  workflows,
  loading,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onViewDetails,
}: {
  workflows: Workflow[];
  loading: boolean;
  selectedIds: Set<number>;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: number, checked: boolean) => void;
  onViewDetails: (workflowId: string) => void;
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
        <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  const allSelected = workflows.length > 0 && workflows.every((w) => selectedIds.has(w.id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-border">
          <tr className="text-left">
            <th className="pb-3 pr-4">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="rounded border-border"
              />
            </th>
            <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground">Workflow ID</th>
            <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground">Type</th>
            <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground">Status</th>
            <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground">Duration</th>
            <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground">Started</th>
            <th className="pb-3 text-sm font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {workflows.map((workflow) => {
            const StatusIcon = getStatusIcon(workflow.status);
            return (
              <tr
                key={workflow.id}
                className="border-b border-border last:border-0 hover:bg-muted/50"
              >
                <td className="py-4 pr-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(workflow.id)}
                    onChange={(e) => onSelectOne(workflow.id, e.target.checked)}
                    className="rounded border-border"
                  />
                </td>
                <td className="py-4 pr-4">
                  <span className="font-mono text-sm text-foreground">
                    {workflow.workflow_id.slice(0, 12)}...
                  </span>
                </td>
                <td className="py-4 pr-4">
                  <span className="text-sm text-foreground">
                    {formatWorkflowType(workflow.workflow_type)}
                  </span>
                </td>
                <td className="py-4 pr-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(workflow.status)}`}
                  >
                    <StatusIcon
                      className={`h-3.5 w-3.5 ${workflow.status === "running" ? "animate-spin" : ""}`}
                    />
                    {workflow.status.toUpperCase()}
                  </span>
                </td>
                <td className="py-4 pr-4 text-sm text-muted-foreground">
                  {formatDuration(workflow.started_at, workflow.completed_at || workflow.failed_at)}
                </td>
                <td className="py-4 pr-4 text-sm text-muted-foreground">
                  {workflow.started_at
                    ? new Date(workflow.started_at).toLocaleString()
                    : "Not started"}
                </td>
                <td className="py-4">
                  <button
                    onClick={() => onViewDetails(workflow.workflow_id)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title="View details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Main History Page Component
// ============================================================================

export default function WorkflowHistoryPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<WorkflowType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const confirmDialog = useConfirmDialog();

  const {
    data: workflowResponse,
    isLoading: loading,
    refetch,
  } = useWorkflows({
    status: statusFilter !== "all" ? statusFilter : undefined,
    workflowType: typeFilter !== "all" ? typeFilter : undefined,
    page,
    pageSize,
  });
  const workflowList = workflowResponse?.workflows;
  const workflows = useMemo(() => workflowList ?? [], [workflowList]);
  const total = workflowResponse?.total ?? 0;
  const totalPages = workflowResponse?.total_pages ?? 0;

  // Client-side filtering for search and date range
  const filteredWorkflows = useMemo(() => {
    return workflows.filter((workflow) => {
      if (searchQuery && !workflow.workflow_id.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (dateFrom && workflow.started_at && new Date(workflow.started_at) < new Date(dateFrom)) {
        return false;
      }
      if (dateTo && workflow.started_at && new Date(workflow.started_at) > new Date(dateTo)) {
        return false;
      }
      return true;
    });
  }, [workflows, searchQuery, dateFrom, dateTo]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredWorkflows.map((w) => w.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleClearFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
  };

  const handleExport = () => {
    const selectedWorkflows = filteredWorkflows.filter((w) => selectedIds.has(w.id));
    const dataToExport = selectedWorkflows.length > 0 ? selectedWorkflows : filteredWorkflows;

    const csv = [
      ["Workflow ID", "Type", "Status", "Started", "Duration", "Error"].join(","),
      ...dataToExport.map((w) =>
        [
          w.workflow_id,
          w.workflow_type,
          w.status,
          w.started_at || "",
          formatDuration(w.started_at, w.completed_at || w.failed_at),
          w.error_message || "",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflows-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkDelete = async () => {
    const workflowIds = Array.from(selectedIds);
    if (workflowIds.length === 0) return;

    const confirmed = await confirmDialog({
      title: "Delete workflows",
      description: `Are you sure you want to delete ${workflowIds.length} workflow(s)? This action cannot be undone?`,
      confirmText: "Delete workflows",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    try {
      // Delete workflows in parallel
      await Promise.all(
        workflowIds.map(async (id) => {
          await apiClient.delete(`/orchestration/workflows/${id}`);
        }),
      );

      // Clear selection
      setSelectedIds(new Set());

      // Show success message
      alert(`Successfully deleted ${workflowIds.length} workflow(s)`);

      // Refresh the list
      window.location.reload();
    } catch (error: any) {
      console.error("Bulk delete failed:", error);
      alert(`Failed to delete workflows: ${error.message || "Unknown error"}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Workflow History</h1>
          <p className="text-muted-foreground mt-1">
            Browse and search historical workflow executions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => {
                  void handleBulkDelete();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete ({selectedIds.size})
              </button>
            </>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Export {selectedIds.size > 0 ? `(${selectedIds.size})` : "All"}
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterPanel
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        searchQuery={searchQuery}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onStatusChange={setStatusFilter}
        onTypeChange={setTypeFilter}
        onSearchChange={setSearchQuery}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onClearFilters={handleClearFilters}
      />

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredWorkflows.length} of {total} workflows
        </span>
        <span>
          Page {page} of {totalPages}
        </span>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg bg-card">
        <WorkflowTable
          workflows={filteredWorkflows}
          loading={loading}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectOne={handleSelectOne}
          onViewDetails={setSelectedWorkflowId}
        />
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
