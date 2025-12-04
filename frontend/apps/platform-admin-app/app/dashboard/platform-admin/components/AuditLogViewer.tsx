"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { ScrollArea } from "@dotmac/ui";
import { Shield, Clock, ChevronLeft, ChevronRight, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { AuditLogFilters, type AuditFilters } from "./AuditLogFilters";
import Link from "next/link";
import { useAuditActivities } from "@/hooks/useAudit";
import type { AuditActivity, ActivitySeverity } from "@/types/audit";
import { SEVERITY_COLORS, formatActivityType, getActivityIcon } from "@/types/audit";

const ITEMS_PER_PAGE = 50;

export function AuditLogViewer() {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  // Use React Query hook for data fetching
  const {
    data: auditData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useAuditActivities(
    {
      ...(filters.userId && { user_id: filters.userId }),
      ...(filters.activityType && { activity_type: filters.activityType }),
      ...(filters.severity && { severity: filters.severity as ActivitySeverity }),
      ...(filters.resourceType && { resource_type: filters.resourceType }),
      ...(filters.resourceId && { resource_id: filters.resourceId }),
      days: filters.days || 30,
      page: currentPage,
      per_page: ITEMS_PER_PAGE,
    },
    true,
  );

  const handleRefresh = useCallback(async () => {
    await refetch();
    toast({
      title: "Refreshed",
      description: "Audit log has been refreshed successfully",
    });
  }, [refetch, toast]);

  const handleFilterChange = useCallback((newFilters: AuditFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  }, []);

  const handleExport = useCallback(
    (format: "csv" | "json") => {
      const activities = auditData?.activities || [];

      if (format === "json") {
        const blob = new Blob([JSON.stringify(activities, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-log-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // CSV format
        const headers = [
          "Timestamp",
          "Activity Type",
          "Severity",
          "User ID",
          "Tenant ID",
          "Action",
          "Resource Type",
          "Resource ID",
          "IP Address",
          "Description",
        ];
        const rows = activities.map((activity) => [
          activity.timestamp,
          activity.activity_type,
          activity.severity,
          activity.user_id || "",
          activity.tenant_id,
          activity.action,
          activity.resource_type || "",
          activity.resource_id || "",
          activity.ip_address || "",
          activity.description,
        ]);
        const csvContent = [
          headers.join(","),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-log-${new Date().toISOString()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast({
        title: "Export Successful",
        description: `Exported ${activities.length} audit log entries as ${format.toUpperCase()}`,
      });
    },
    [auditData, toast],
  );

  const activities = auditData?.activities || [];
  const totalPages = auditData?.total_pages || 0;
  const total = auditData?.total || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Platform Audit Log
            </CardTitle>
            <CardDescription>
              Recent platform administrator actions across all tenants
            </CardDescription>
          </div>
          <Badge variant="outline">{total} total activities</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <AuditLogFilters
          onFilterChange={handleFilterChange}
          onExport={handleExport}
          onRefresh={handleRefresh}
          isRefreshing={isRefetching}
        />

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900">Unable to load audit log</h4>
              <p className="text-sm text-red-700 mt-1">
                {error instanceof Error
                  ? error.message
                  : "An error occurred while fetching audit activities"}
              </p>
            </div>
          </div>
        )}

        {/* Activities List */}
        <ScrollArea className="h-[600px] pr-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              Loading audit log...
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No audit activities found</p>
              <p className="text-sm mt-1">
                {total === 0
                  ? "Platform admin actions will be logged here for compliance"
                  : "Try adjusting your filters"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <AuditActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, total)} of {total} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || isLoading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Audit Activity Card Component
// ============================================================================

function AuditActivityCard({ activity }: { activity: AuditActivity }) {
  const icon = getActivityIcon(activity.activity_type);
  const severityColor = SEVERITY_COLORS[activity.severity];

  return (
    <div className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        {/* Icon and Content */}
        <div className="flex items-start gap-3 flex-1">
          {/* Activity Icon */}
          <div className="text-2xl flex-shrink-0 mt-1">{icon}</div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Header with badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs">
                {formatActivityType(activity.activity_type)}
              </Badge>
              <Badge className={severityColor}>{activity.severity.toUpperCase()}</Badge>
              {activity.tenant_id && (
                <Badge variant="secondary" className="font-mono text-xs">
                  Tenant: {activity.tenant_id.slice(0, 8)}...
                </Badge>
              )}
            </div>

            {/* Description */}
            <p className="text-sm font-medium mb-2">{activity.description}</p>

            {/* Metadata */}
            <div className="space-y-1 text-xs text-muted-foreground">
              {activity.user_id && (
                <div className="flex items-center gap-2">
                  <span>User:</span>
                  <span className="font-mono">{activity.user_id}</span>
                  <Link
                    href={`/dashboard/platform-admin/audit/user/${activity.user_id}`}
                    className="text-blue-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Activity
                  </Link>
                </div>
              )}
              {activity.resource_type && (
                <div className="flex items-center gap-2">
                  <span>Resource:</span>
                  <span className="font-mono">{activity.resource_type}</span>
                  {activity.resource_id && (
                    <span className="font-mono text-xs">
                      ({activity.resource_id.slice(0, 8)}...)
                    </span>
                  )}
                </div>
              )}
              {activity.ip_address && (
                <div className="flex items-center gap-2">
                  <span>IP Address:</span>
                  <span className="font-mono">{activity.ip_address}</span>
                </div>
              )}
              {activity.action && (
                <div className="flex items-center gap-2">
                  <span>Action:</span>
                  <span className="font-mono">{activity.action}</span>
                </div>
              )}
            </div>

            {/* Details */}
            {activity.details && Object.keys(activity.details).length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  View Details
                </summary>
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(activity.details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
          <Clock className="h-3 w-3" />
          <div className="text-right">
            <div>{new Date(activity.timestamp).toLocaleDateString()}</div>
            <div>{new Date(activity.timestamp).toLocaleTimeString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
