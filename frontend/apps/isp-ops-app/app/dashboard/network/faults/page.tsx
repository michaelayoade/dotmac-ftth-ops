"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { EnhancedDataTable, BulkAction } from "@dotmac/ui";
import { createSortableHeader } from "@dotmac/ui";
import { UniversalChart } from "@dotmac/primitives";
import { AlarmDetailModal } from "@/components/faults/AlarmDetailModal";
import {
  CheckCircle,
  X,
  AlertTriangle,
  Clock,
  Info,
  RefreshCw,
  FileText,
  Bell,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useRBAC } from "@/contexts/RBACContext";
import {
  useAlarms,
  useAlarmStatistics,
  useAlarmOperations,
  useSLACompliance,
  useSLARollupStats,
  Alarm as AlarmType,
  AlarmSeverity,
  AlarmStatus,
} from "@/hooks/useFaults";

// ============================================================================
// Types
// ============================================================================

type Alarm = AlarmType;

interface AlarmFrequencyData {
  hour: string;
  critical: number;
  major: number;
  minor: number;
  warning: number;
  info: number;
}

// ============================================================================
// Component
// ============================================================================

export default function FaultManagementPage() {
  const { hasPermission } = useRBAC();
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [excludeMaintenance, setExcludeMaintenance] = useState(true);

  const hasFaultAccess = hasPermission("faults.alarms.read");

  // Fetch alarms from API
  const {
    alarms: apiAlarms,
    isLoading: alarmsLoading,
    refetch: refetchAlarms,
  } = useAlarms({
    limit: 100,
    offset: 0,
  });

  // Fetch alarm statistics
  const { statistics: apiStatistics } = useAlarmStatistics();

  // Alarm operations
  const {
    acknowledgeAlarms,
    clearAlarms,
    createTickets,
    isLoading: operationsLoading,
  } = useAlarmOperations();
  const {
    data: slaCompliance = [],
    isLoading: slaLoading,
    error: slaError,
    refetch: refetchSla,
  } = useSLACompliance({ days: 30, excludeMaintenance });

  const { stats: slaRollupStats, isLoading: slaRollupLoading } = useSLARollupStats(30, 99.9);

  const alarms = apiAlarms;
  const isLoading = alarmsLoading || operationsLoading;

  // Calculate statistics (prefer API statistics, fallback to calculated)
  const statistics = useMemo(() => {
    if (apiStatistics) {
      return {
        active: apiStatistics.active_alarms,
        critical: apiStatistics.critical_alarms,
        acknowledged: apiStatistics.acknowledged_alarms,
        totalImpacted: apiStatistics.total_impacted_subscribers || 0,
      };
    }

    // Fallback to calculated statistics
    const active = alarms.filter((a) => a.status === "active").length;
    const critical = alarms.filter(
      (a) => a.severity === "critical" && a.status === "active",
    ).length;
    const acknowledged = alarms.filter((a) => a.status === "acknowledged").length;
    const totalImpacted = alarms
      .filter((a) => a.status === "active")
      .reduce((sum, a) => sum + a.subscriber_count, 0);

    return { active, critical, acknowledged, totalImpacted };
  }, [alarms, apiStatistics]);

  const alarmFrequencyData = useMemo(() => {
    if (!alarms.length) {
      return [];
    }

    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      critical: 0,
      major: 0,
      minor: 0,
      warning: 0,
      info: 0,
    }));

    alarms.forEach((alarm) => {
      const timestamp =
        alarm.last_occurrence ||
        alarm.first_occurrence ||
        alarm.created_at ||
        new Date().toISOString();
      const hour = new Date(timestamp).getHours();
      const severity = (alarm.severity || "info").toLowerCase();
      const bucket = buckets[hour];
      if (!bucket) {
        return;
      }
      if (severity in bucket) {
        (bucket as any)[severity] += 1;
      } else {
        bucket.info += 1;
      }
    });

    return buckets;
  }, [alarms]);

  const slaChartData = useMemo(() => {
    return slaCompliance.map((entry) => ({
      dateLabel: new Date(entry.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      compliance: entry.compliance_percentage,
      target: entry.target_percentage,
    }));
  }, [slaCompliance]);

  // ============================================================================
  // Table Configuration
  // ============================================================================

  const columns: ColumnDef<Alarm>[] = [
    {
      accessorKey: "severity",
      header: "Severity",
      cell: ({ row }) => {
        const severity = row.getValue("severity") as AlarmSeverity;
        const config = {
          critical: { color: "bg-red-600 text-white", icon: AlertTriangle },
          major: { color: "bg-orange-500 text-white", icon: AlertTriangle },
          minor: { color: "bg-yellow-500 text-black", icon: Clock },
          warning: { color: "bg-yellow-400 text-black", icon: AlertTriangle },
          info: { color: "bg-blue-500 text-white", icon: Info },
        };
        const { color, icon: Icon } = config[severity];
        return (
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <Badge className={color}>{severity}</Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "alarm_type",
      header: createSortableHeader("Type"),
      cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("alarm_type")}</div>,
    },
    {
      accessorKey: "title",
      header: createSortableHeader("Title"),
      cell: ({ row }) => (
        <div className="max-w-md">
          <div className="font-medium">{row.getValue("title")}</div>
          {row.original.resource_name && (
            <div className="text-xs text-muted-foreground mt-1">{row.original.resource_name}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "customer_name",
      header: "Customer",
      cell: ({ row }) => {
        const customerName = row.getValue("customer_name") as string | undefined;
        const subscriberCount = row.original.subscriber_count;
        return customerName || subscriberCount > 0 ? (
          <div>
            <div>{customerName || "Multiple"}</div>
            {subscriberCount > 0 && (
              <div className="text-xs text-muted-foreground">
                {subscriberCount} subscriber{subscriberCount !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as AlarmStatus;
        const statusConfig = {
          active: { color: "bg-red-500 text-white", label: "Active" },
          acknowledged: {
            color: "bg-yellow-500 text-black",
            label: "Acknowledged",
          },
          cleared: { color: "bg-blue-500 text-white", label: "Cleared" },
          resolved: { color: "bg-green-500 text-white", label: "Resolved" },
        };
        const { color, label } = statusConfig[status];
        return <Badge className={color}>{label}</Badge>;
      },
    },
    {
      accessorKey: "occurrence_count",
      header: createSortableHeader("Count"),
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant="outline">{row.getValue("occurrence_count")}</Badge>
        </div>
      ),
    },
    {
      accessorKey: "last_occurrence",
      header: createSortableHeader("Last Seen"),
      cell: ({ row }) => {
        const date = new Date(row.getValue("last_occurrence"));
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);

        let timeAgo = "";
        if (hours > 24) {
          timeAgo = `${Math.floor(hours / 24)}d ago`;
        } else if (hours > 0) {
          timeAgo = `${hours}h ago`;
        } else {
          timeAgo = `${minutes}m ago`;
        }

        return (
          <div>
            <div className="text-sm">{timeAgo}</div>
            <div className="text-xs text-muted-foreground">{date.toLocaleTimeString()}</div>
          </div>
        );
      },
    },
  ];

  // ============================================================================
  // Bulk Actions
  // ============================================================================

  const bulkActions: BulkAction<Alarm>[] = [
    {
      label: "Acknowledge",
      icon: CheckCircle,
      action: async (selected) => {
        const alarmIds = selected.map((a) => a.id);
        const success = await acknowledgeAlarms(alarmIds, "Bulk acknowledged via dashboard");

        if (success) {
          await refetchAlarms();
        }
      },
      disabled: (selected) => selected.every((a) => a.status !== "active"),
    },
    {
      label: "Clear Alarms",
      icon: X,
      action: async (selected) => {
        const alarmIds = selected.map((a) => a.id);
        const success = await clearAlarms(alarmIds);

        if (success) {
          await refetchAlarms();
        }
      },
    },
    {
      label: "Create Ticket",
      icon: FileText,
      action: async (selected) => {
        const alarmIds = selected.map((a) => a.id);
        const success = await createTickets(alarmIds, "normal");

        if (success) {
          alert(`Successfully created tickets for ${selected.length} alarm(s)`);
          await refetchAlarms();
        }
      },
    },
  ];

  if (!hasFaultAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Fault Management</CardTitle>
            <CardDescription>
              Access requires <code>faults.alarms.read</code> permission.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fault Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage network alarms and SLA compliance
          </p>
        </div>
        <Button onClick={() => refetchAlarms()} variant="outline" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Alarms</CardDescription>
            <CardTitle className="text-3xl">{statistics.active}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Currently active in the system</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Critical Alarms</CardDescription>
            <CardTitle className="text-3xl text-red-600">{statistics.critical}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Requiring immediate attention</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Acknowledged</CardDescription>
            <CardTitle className="text-3xl">{statistics.acknowledged}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Being handled by operators</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Impacted Subscribers</CardDescription>
            <CardTitle className="text-3xl">{statistics.totalImpacted}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Affected by active alarms</div>
          </CardContent>
        </Card>
      </div>

      {/* SLA Rollup Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>SLA Performance Summary (Last 30 Days)</CardTitle>
          <CardDescription>
            Aggregate downtime, breach metrics, and compliance tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Total Downtime</span>
              <span className="text-2xl font-bold">
                {slaRollupLoading
                  ? "..."
                  : `${((slaRollupStats?.total_downtime_minutes ?? 0) / 60).toFixed(1)}h`}
              </span>
              <span className="text-xs text-muted-foreground">
                {slaRollupStats?.total_downtime_minutes ?? 0} minutes total
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Total Breaches</span>
              <span className="text-2xl font-bold">
                {slaRollupLoading ? "..." : (slaRollupStats?.total_breaches ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground">Days below {99.9}% uptime</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Worst Day</span>
              <span className="text-2xl font-bold">
                {slaRollupLoading
                  ? "..."
                  : `${(slaRollupStats?.worst_day_compliance ?? 100).toFixed(2)}%`}
              </span>
              <span className="text-xs text-muted-foreground">Minimum compliance in period</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Average Compliance</span>
              <span className="text-2xl font-bold">
                {slaRollupLoading
                  ? "..."
                  : `${(slaRollupStats?.avg_compliance ?? 100).toFixed(2)}%`}
              </span>
              <span className="text-xs text-muted-foreground">Mean uptime across all days</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alarm Frequency Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Alarm Frequency (Last 24 Hours)</CardTitle>
          <CardDescription>Alarms by severity over time</CardDescription>
        </CardHeader>
        <CardContent>
          {alarmFrequencyData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No alarm telemetry available for the past 24 hours.
            </p>
          ) : (
            <UniversalChart
              {...({
                type: "bar",
                data: alarmFrequencyData,
                series: [
                  { key: "critical", name: "Critical", color: "#dc2626" },
                  { key: "major", name: "Major", color: "#f97316" },
                  { key: "minor", name: "Minor", color: "#eab308" },
                  { key: "warning", name: "Warning", color: "#facc15" },
                  { key: "info", name: "Info", color: "#3b82f6" },
                ],
                xAxis: { dataKey: "hour" },
                height: 300,
                stacked: true,
              } as any)}
            />
          )}
        </CardContent>
      </Card>

      {/* SLA Compliance Chart */}
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>SLA Compliance Trends</CardTitle>
            <CardDescription>Network availability over the last 30 days</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="exclude-maintenance" className="text-sm text-muted-foreground">
              Exclude maintenance windows
            </Label>
            <Switch
              id="exclude-maintenance"
              checked={excludeMaintenance}
              onCheckedChange={(checked) => setExcludeMaintenance(checked)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {slaLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : slaError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>Unable to load SLA compliance data.</span>
                <Button variant="outline" size="sm" onClick={() => refetchSla()}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : slaChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No SLA telemetry is available for this period.
            </p>
          ) : (
            <UniversalChart
              type="line"
              data={slaChartData}
              series={[
                {
                  key: "compliance",
                  name: "Actual Compliance",
                  type: "area",
                  color: "#10b981",
                },
                {
                  key: "target",
                  name: "Target",
                  strokeDasharray: "5 5",
                  color: "#6b7280",
                },
              ]}
              xAxis={{ dataKey: "dateLabel" }}
              yAxis={{
                left: {
                  format: (v: number) => `${v.toFixed(1)}%`,
                  domain: [95, 100],
                },
              }}
              height={300}
              smooth
            />
          )}
        </CardContent>
      </Card>

      {/* Alarm List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Alarms</CardTitle>
          <CardDescription>
            All alarms in the system with filtering and bulk actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnhancedDataTable
            data={alarms}
            columns={columns}
            searchColumn="title"
            searchPlaceholder="Search alarms by title..."
            isLoading={isLoading}
            selectable
            bulkActions={bulkActions}
            exportable
            exportFilename="alarms"
            exportColumns={[
              "alarm_id",
              "severity",
              "status",
              "alarm_type",
              "title",
              "resource_name",
              "customer_name",
            ]}
            filterable
            filters={[
              {
                column: "severity",
                label: "Severity",
                type: "select",
                options: [
                  { label: "Critical", value: "critical" },
                  { label: "Major", value: "major" },
                  { label: "Minor", value: "minor" },
                  { label: "Warning", value: "warning" },
                  { label: "Info", value: "info" },
                ],
              },
              {
                column: "status",
                label: "Status",
                type: "select",
                options: [
                  { label: "Active", value: "active" },
                  { label: "Acknowledged", value: "acknowledged" },
                  { label: "Cleared", value: "cleared" },
                  { label: "Resolved", value: "resolved" },
                ],
              },
              {
                column: "source",
                label: "Source",
                type: "select",
                options: [
                  { label: "GenieACS", value: "genieacs" },
                  { label: "VOLTHA", value: "voltha" },
                  { label: "NetBox", value: "netbox" },
                  { label: "Manual", value: "manual" },
                ],
              },
            ]}
            onRowClick={(alarm) => {
              setSelectedAlarm(alarm);
              setIsDetailModalOpen(true);
            }}
          />
        </CardContent>
      </Card>

      {/* Alarm Detail Modal */}
      <AlarmDetailModal
        alarm={selectedAlarm}
        open={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedAlarm(null);
        }}
        onUpdate={() => {
          refetchAlarms();
        }}
      />
    </main>
  );
}
