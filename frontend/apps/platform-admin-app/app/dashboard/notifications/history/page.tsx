/**
 * Notification History/Logs Page
 *
 * Comprehensive view of all sent communications with delivery tracking,
 * filtering, and retry capabilities.
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Mail,
  MessageSquare,
  Bell,
  Webhook,
  RefreshCw,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useCommunicationLogs,
  type CommunicationLog,
  type CommunicationType,
  type CommunicationStatus,
} from "@/hooks/useNotifications";
import {
  EnhancedDataTable,
  type ColumnDef,
  type BulkAction,
  type QuickFilter,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";
import { useRBAC } from "@/contexts/RBACContext";
import { formatDistanceToNow, format } from "date-fns";
import { CommunicationDetailModal } from "@/components/notifications/CommunicationDetailModal";

const createBulkIcon = (Icon: LucideIcon) => {
  const Wrapped = ({ className }: { className?: string }) => <Icon className={className} />;
  Wrapped.displayName = `BulkIcon(${Icon.displayName ?? Icon.name ?? "Icon"})`;
  return Wrapped;
};

const RetryIcon = createBulkIcon(RefreshCw);
const DownloadIcon = createBulkIcon(Download);

export default function NotificationHistoryPage() {
  const { hasPermission } = useRBAC();
  const canRead = hasPermission("notifications.read") || hasPermission("admin");

  // Filters
  const [typeFilter, setTypeFilter] = useState<CommunicationType | "">("");
  const [statusFilter, setStatusFilter] = useState<CommunicationStatus | "">("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { logs, total, isLoading, error, refetch, retryFailedCommunication } = useCommunicationLogs(
    {
      ...(typeFilter && { type: typeFilter }),
      ...(statusFilter && { status: statusFilter }),
      ...(recipientFilter && { recipient: recipientFilter }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      page,
      pageSize,
    },
  );

  const [selectedLog, setSelectedLog] = useState<CommunicationLog | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const confirmDialog = useConfirmDialog();

  // Statistics
  const stats = useMemo(() => {
    // In production, these would come from a separate stats endpoint
    const totalSent = logs.filter((l) => l.status === "sent" || l.status === "delivered").length;
    const totalFailed = logs.filter((l) => l.status === "failed" || l.status === "bounced").length;
    const totalPending = logs.filter((l) => l.status === "pending").length;
    const emailCount = logs.filter((l) => l.type === "email").length;
    const smsCount = logs.filter((l) => l.type === "sms").length;

    return {
      totalSent,
      totalFailed,
      totalPending,
      emailCount,
      smsCount,
      deliveryRate: logs.length > 0 ? ((totalSent / logs.length) * 100).toFixed(1) : "0.0",
    };
  }, [logs]);

  // Columns definition
  const handleViewDetails = useCallback(
    (log: CommunicationLog) => {
      setSelectedLog(log);
      setIsDetailModalOpen(true);
    },
    [setIsDetailModalOpen, setSelectedLog],
  );

  const handleRetry = useCallback(
    async (log: CommunicationLog) => {
      if (!log.id) return;
      const shouldRetry = await confirmDialog({
        title: "Retry communication",
        description: `Retry sending to ${log.recipient}?`,
        confirmText: "Retry",
      });
      if (!shouldRetry) return;

      const success = await retryFailedCommunication(log.id);
      if (success) {
        alert("Communication queued for retry");
        refetch();
      } else {
        alert("Failed to retry communication");
      }
    },
    [refetch, retryFailedCommunication, confirmDialog],
  );

  const columns: ColumnDef<CommunicationLog>[] = useMemo(
    () => [
      {
        id: "type",
        header: "Type",
        accessorKey: "type",
        cell: ({ row }) => {
          const typeIcons = {
            email: Mail,
            sms: MessageSquare,
            push: Bell,
            webhook: Webhook,
          };
          const typeColors = {
            email: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
            sms: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
            push: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
            webhook: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
          };

          const Icon = typeIcons[row.original.type];

          return (
            <Badge className={typeColors[row.original.type]}>
              <Icon className="mr-1 h-3 w-3" />
              {row.original.type.toUpperCase()}
            </Badge>
          );
        },
      },
      {
        id: "recipient",
        header: "Recipient",
        accessorKey: "recipient",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-sm">{row.original.recipient}</span>
            {row.original.subject && (
              <span className="text-xs text-muted-foreground line-clamp-1">
                {row.original.subject}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "template",
        header: "Template",
        accessorKey: "template_name",
        cell: ({ row }) =>
          row.original.template_name ? (
            <span className="text-sm">{row.original.template_name}</span>
          ) : (
            <span className="text-sm text-muted-foreground">Custom</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => {
          const statusConfig = {
            pending: {
              icon: Clock,
              className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
            },
            sent: {
              icon: CheckCircle2,
              className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
            },
            delivered: {
              icon: CheckCircle2,
              className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
            },
            failed: {
              icon: XCircle,
              className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
            },
            bounced: {
              icon: AlertTriangle,
              className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
            },
            cancelled: {
              icon: XCircle,
              className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
            },
          };

          const config = statusConfig[row.original.status];
          const Icon = config.icon;

          return (
            <Badge className={config.className}>
              <Icon className="mr-1 h-3 w-3" />
              {row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
            </Badge>
          );
        },
      },
      {
        id: "provider",
        header: "Provider",
        accessorKey: "provider",
        cell: ({ row }) =>
          row.original.provider ? (
            <span className="text-sm">{row.original.provider}</span>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          ),
      },
      {
        id: "sent_at",
        header: "Sent",
        accessorKey: "sent_at",
        cell: ({ row }) =>
          row.original.sent_at ? (
            <div className="flex flex-col">
              <span className="text-sm">
                {formatDistanceToNow(new Date(row.original.sent_at), {
                  addSuffix: true,
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(row.original.sent_at), "MMM d, HH:mm")}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Not sent</span>
          ),
      },
      {
        id: "retry_count",
        header: "Retries",
        accessorKey: "retry_count",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.retry_count > 0 ? row.original.retry_count : "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewDetails(row.original)}
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {(row.original.status === "failed" || row.original.status === "bounced") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRetry(row.original)}
                title="Retry sending"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [handleRetry, handleViewDetails],
  );

  // Bulk actions
  const bulkActions: BulkAction<CommunicationLog>[] = useMemo(
    () => [
      {
        label: "Retry Failed",
        icon: RetryIcon,
        action: async (selected) => {
          const failedLogs = selected.filter(
            (log) => log.status === "failed" || log.status === "bounced",
          );

          if (failedLogs.length === 0) {
            alert("No failed communications to retry");
            return;
          }

          const confirmed = await confirmDialog({
            title: "Retry communications",
            description: `Retry ${failedLogs.length} failed communication(s)?`,
            confirmText: "Retry",
          });
          if (!confirmed) {
            return;
          }
          for (const log of failedLogs) {
            await retryFailedCommunication(log.id);
          }
          refetch();
        },
        variant: "default" as const,
      },
      {
        label: "Export Selected",
        icon: DownloadIcon,
        action: async (selected) => {
          const csv = convertToCSV(selected);
          downloadCSV(csv, "communication-logs.csv");
        },
        variant: "outline" as const,
      },
    ],
    [retryFailedCommunication, refetch, confirmDialog],
  );

  // Quick filters
  const quickFilters: QuickFilter<CommunicationLog>[] = useMemo(
    () => [
      {
        label: "Failed",
        filter: (log: CommunicationLog) => log.status === "failed" || log.status === "bounced",
      },
      {
        label: "Pending",
        filter: (log: CommunicationLog) => log.status === "pending",
      },
      {
        label: "Delivered",
        filter: (log: CommunicationLog) => log.status === "delivered",
      },
      {
        label: "Email",
        filter: (log: CommunicationLog) => log.type === "email",
      },
      {
        label: "SMS",
        filter: (log: CommunicationLog) => log.type === "sms",
      },
      {
        label: "Has Errors",
        filter: (log: CommunicationLog) => !!log.error_message,
      },
      {
        label: "Retried",
        filter: (log: CommunicationLog) => log.retry_count > 0,
      },
    ],
    [],
  );

  // Handlers
  const handleExportAll = () => {
    const csv = convertToCSV(logs);
    downloadCSV(csv, "communication-logs-all.csv");
  };

  const handleClearFilters = () => {
    setTypeFilter("");
    setStatusFilter("");
    setRecipientFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  // Permission check
  if (!canRead) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don&apos;t have permission to view notification history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please contact your administrator to request access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notification History</h1>
          <p className="text-muted-foreground">
            View and manage all sent communications with delivery tracking
          </p>
        </div>
        <Button onClick={handleExportAll} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export All
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.totalSent}
            </div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.totalFailed}
            </div>
            <p className="text-xs text-muted-foreground">Delivery failed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.totalPending}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.emailCount}
            </div>
            <p className="text-xs text-muted-foreground">Email messages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SMS</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.smsCount}
            </div>
            <p className="text-xs text-muted-foreground">SMS messages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : `${stats.deliveryRate}%`}
            </div>
            <p className="text-xs text-muted-foreground">Success rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filters</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="type-filter">Type</Label>
              <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                <SelectTrigger id="type-filter">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipient-filter">Recipient</Label>
              <Input
                id="recipient-filter"
                value={recipientFilter}
                onChange={(e) => setRecipientFilter(e.target.value)}
                placeholder="Email or phone..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Communication Logs</CardTitle>
          <CardDescription>
            Showing {logs.length} of {total} communications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
              <p className="text-sm text-red-800 dark:text-red-200">
                Failed to load logs. Please try again.
              </p>
              <Button variant="link" size="sm" onClick={() => void refetch()} className="mt-2">
                Retry
              </Button>
            </div>
          )}

          {!error && (
            <EnhancedDataTable
              data={logs}
              columns={columns}
              searchKey="recipient"
              searchPlaceholder="Search by recipient..."
              bulkActions={bulkActions}
              quickFilters={quickFilters}
              isLoading={isLoading}
            />
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedLog && (
        <CommunicationDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedLog(null);
          }}
          log={selectedLog}
          onRetry={async () => {
            await retryFailedCommunication(selectedLog.id);
            setIsDetailModalOpen(false);
            setSelectedLog(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// Helper functions
function convertToCSV(logs: CommunicationLog[]): string {
  const headers = [
    "Type",
    "Recipient",
    "Subject",
    "Status",
    "Sent At",
    "Provider",
    "Retry Count",
    "Error",
  ];
  const rows = logs.map((log) => [
    log.type,
    log.recipient,
    log.subject || "",
    log.status,
    log.sent_at || "",
    log.provider || "",
    log.retry_count.toString(),
    log.error_message || "",
  ]);

  return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
