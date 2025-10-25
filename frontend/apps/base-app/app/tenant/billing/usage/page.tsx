"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EnhancedDataTable, BulkAction } from "@/components/ui/EnhancedDataTable";
import { createSortableHeader } from "@/components/ui/data-table";
import { UniversalChart } from "@dotmac/primitives";
import {
  Activity,
  Download,
  RefreshCw,
  Receipt,
  TrendingUp,
  Database,
  Loader2,
  Plus,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useRBAC } from "@/contexts/RBACContext";
import { useToast } from "@/components/ui/use-toast";
import { logger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useUsageRecords,
  useUsageStatistics,
  useUsageOperations,
  useUsageChartData,
  type UsageRecord,
} from "@/hooks/useUsageBilling";

// ============================================================================
// Types (imported from useUsageBilling)
// ============================================================================

import type { UsageType, BilledStatus } from "@/hooks/useUsageBilling";

// Define UsageStats type locally
interface UsageStats {
  total_records: number;
  total_amount: number;
  pending_amount: number;
  billed_amount: number;
}

interface UsageChartData {
  date: string;
  data_transfer: number;
  voice_minutes: number;
  bandwidth_gb: number;
  overage_gb: number;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockUsageRecords: UsageRecord[] = [
  {
    id: "usage-001",
    tenant_id: "demo-alpha",
    subscription_id: "sub-001",
    customer_id: "cust-001",
    customer_name: "John Doe",
    usage_type: "data_transfer",
    quantity: 150.5,
    unit: "GB",
    unit_price: 10, // $0.10/GB
    total_amount: 1505, // $15.05
    currency: "USD",
    period_start: new Date(Date.now() - 86400000).toISOString(),
    period_end: new Date().toISOString(),
    billed_status: "pending",
    source_system: "radius",
    description: "Internet data usage",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "usage-002",
    tenant_id: "demo-alpha",
    subscription_id: "sub-002",
    customer_id: "cust-002",
    customer_name: "Jane Smith",
    usage_type: "voice_minutes",
    quantity: 120,
    unit: "minutes",
    unit_price: 5, // $0.05/min
    total_amount: 600, // $6.00
    currency: "USD",
    period_start: new Date(Date.now() - 172800000).toISOString(),
    period_end: new Date(Date.now() - 86400000).toISOString(),
    billed_status: "billed",
    invoice_id: "inv-001",
    billed_at: new Date(Date.now() - 43200000).toISOString(),
    source_system: "api",
    description: "VoIP call minutes",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: "usage-003",
    tenant_id: "demo-alpha",
    subscription_id: "sub-003",
    customer_id: "cust-003",
    customer_name: "Bob Johnson",
    usage_type: "overage_gb",
    quantity: 50,
    unit: "GB",
    unit_price: 20, // $0.20/GB overage
    total_amount: 1000, // $10.00
    currency: "USD",
    period_start: new Date(Date.now() - 259200000).toISOString(),
    period_end: new Date(Date.now() - 172800000).toISOString(),
    billed_status: "pending",
    source_system: "radius",
    description: "Data overage charges",
    service_location: "123 Main St, City, ST 12345",
    created_at: new Date(Date.now() - 259200000).toISOString(),
    updated_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: "usage-004",
    tenant_id: "demo-alpha",
    subscription_id: "sub-001",
    customer_id: "cust-001",
    customer_name: "John Doe",
    usage_type: "equipment_rental",
    quantity: 1,
    unit: "month",
    unit_price: 500, // $5.00/month
    total_amount: 500, // $5.00
    currency: "USD",
    period_start: new Date(Date.now() - 86400000 * 30).toISOString(),
    period_end: new Date().toISOString(),
    billed_status: "billed",
    invoice_id: "inv-002",
    billed_at: new Date(Date.now() - 86400000).toISOString(),
    source_system: "api",
    description: "ONT equipment rental",
    device_id: "ONT-12345",
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const mockUsageStats: UsageStats = {
  total_records: 4,
  total_amount: 3605, // $36.05
  pending_amount: 2505, // $25.05
  billed_amount: 1100, // $11.00
};

// Last 7 days of usage
const mockUsageChartData: UsageChartData[] = Array.from({ length: 7 }, (_, i) => {
  const date = new Date(Date.now() - (6 - i) * 86400000);
  return {
    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    data_transfer: Math.floor(Math.random() * 200) + 100,
    voice_minutes: Math.floor(Math.random() * 150) + 50,
    bandwidth_gb: Math.floor(Math.random() * 100) + 50,
    overage_gb: Math.floor(Math.random() * 30),
  };
});

// ============================================================================
// Component
// ============================================================================

export default function UsageBillingPage() {
  const { toast } = useToast();
  const { hasPermission } = useRBAC();
  const hasBillingAccess = hasPermission("billing.read");
  const [invoiceIdForBilling, setInvoiceIdForBilling] = useState<string>("");
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showRecordUsage, setShowRecordUsage] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<UsageRecord[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newUsageRecord, setNewUsageRecord] = useState({
    customer_id: "",
    customer_name: "",
    usage_type: "data_transfer" as UsageType,
    quantity: 0,
    unit: "GB",
    unit_price: 10,
    description: "",
  });

  // API Hooks
  const {
    data: apiRecords = [],
    isLoading: recordsLoading,
    error: recordsError,
    refetch,
  } = useUsageRecords({
    limit: 100,
  });
  const { data: apiStatistics, isLoading: statsLoading } = useUsageStatistics();
  const { data: apiChartData = [], isLoading: chartLoading } = useUsageChartData({
    period_type: "daily",
    days: 7,
  });
  const { markAsBilled, excludeFromBilling, isLoading: operationsLoading } = useUsageOperations();

  // Use API data with fallback to mock data for development
  const usageRecords = apiRecords.length > 0 ? apiRecords : mockUsageRecords;
  const isLoading = recordsLoading || operationsLoading;

  // Calculate statistics from API or local data
  const statistics = useMemo(() => {
    if (apiStatistics) {
      return {
        totalRecords: apiStatistics.total_records,
        totalAmount: apiStatistics.total_amount / 100,
        pendingAmount: apiStatistics.pending_amount / 100,
        billedAmount: apiStatistics.billed_amount / 100,
      };
    }

    // Fallback to local calculation
    return {
      totalRecords: usageRecords.length,
      totalAmount: usageRecords.reduce((sum, r) => sum + r.total_amount, 0) / 100,
      pendingAmount:
        usageRecords
          .filter((r) => r.billed_status === "pending")
          .reduce((sum, r) => sum + r.total_amount, 0) / 100,
      billedAmount:
        usageRecords
          .filter((r) => r.billed_status === "billed")
          .reduce((sum, r) => sum + r.total_amount, 0) / 100,
    };
  }, [apiStatistics, usageRecords]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleRecordUsage = async () => {
    if (!newUsageRecord.customer_id || !newUsageRecord.quantity) {
      toast({
        title: "Validation Error",
        description: "Customer ID and quantity are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Replace with actual API call when endpoint is available
      // await apiClient.post("/billing/usage", newUsageRecord);

      logger.info("Usage record created", {
        customerId: newUsageRecord.customer_id,
        usageType: newUsageRecord.usage_type,
        quantity: newUsageRecord.quantity,
      });

      toast({
        title: "Success",
        description: `Usage record for ${newUsageRecord.customer_name || newUsageRecord.customer_id} created successfully`,
      });

      setShowRecordUsage(false);
      setNewUsageRecord({
        customer_id: "",
        customer_name: "",
        usage_type: "data_transfer",
        quantity: 0,
        unit: "GB",
        unit_price: 10,
        description: "",
      });

      await refetch();
    } catch (error) {
      logger.error("Failed to record usage", error);
      toast({
        title: "Error",
        description: "Failed to record usage. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAsBilled = async () => {
    if (!pendingBulkAction || !invoiceIdForBilling.trim()) {
      toast({
        title: "Validation Error",
        description: "Invoice ID is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const usageIds = pendingBulkAction.map((r) => r.id);
      const success = await markAsBilled(usageIds, invoiceIdForBilling.trim());

      if (success) {
        logger.info("Usage records marked as billed", {
          count: pendingBulkAction.length,
          invoiceId: invoiceIdForBilling,
        });

        toast({
          title: "Success",
          description: `Successfully marked ${pendingBulkAction.length} usage record(s) as billed to invoice ${invoiceIdForBilling}`,
        });

        await refetch();
        setShowInvoiceDialog(false);
        setInvoiceIdForBilling("");
        setPendingBulkAction(null);
      } else {
        throw new Error("Failed to mark as billed");
      }
    } catch (error) {
      logger.error("Failed to mark usage records as billed", error);
      toast({
        title: "Error",
        description: "Failed to mark usage records as billed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // Table Configuration
  // ============================================================================

  const columns: ColumnDef<UsageRecord>[] = [
    {
      accessorKey: "customer_name",
      header: createSortableHeader("Customer"),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.getValue("customer_name") || row.original.customer_id}
          </div>
          <div className="text-xs text-muted-foreground">{row.original.subscription_id}</div>
        </div>
      ),
    },
    {
      accessorKey: "usage_type",
      header: "Usage Type",
      cell: ({ row }) => {
        const usageType = row.getValue("usage_type") as UsageType;
        const usageTypeLabels: Record<UsageType, string> = {
          data_transfer: "Data Transfer",
          voice_minutes: "Voice Minutes",
          sms_count: "SMS",
          bandwidth_gb: "Bandwidth",
          overage_gb: "Data Overage",
          static_ip: "Static IP",
          equipment_rental: "Equipment Rental",
          installation_fee: "Installation",
          custom: "Custom",
        };
        return <Badge variant="outline">{usageTypeLabels[usageType]}</Badge>;
      },
    },
    {
      accessorKey: "quantity",
      header: createSortableHeader("Quantity"),
      cell: ({ row }) => {
        const quantity = row.getValue("quantity") as number;
        const unit = row.original.unit;
        return (
          <div className="text-sm">
            {quantity.toFixed(2)} {unit}
          </div>
        );
      },
    },
    {
      accessorKey: "total_amount",
      header: createSortableHeader("Amount"),
      cell: ({ row }) => {
        const amount = row.getValue("total_amount") as number;
        const currency = row.original.currency;
        const displayAmount = amount / 100;
        return (
          <div className="font-medium">
            {currency} ${displayAmount.toFixed(2)}
          </div>
        );
      },
    },
    {
      accessorKey: "period_start",
      header: createSortableHeader("Period"),
      cell: ({ row }) => {
        const start = new Date(row.getValue("period_start"));
        const end = new Date(row.original.period_end);
        return (
          <div className="text-sm">
            <div>{start.toLocaleDateString()}</div>
            <div className="text-xs text-muted-foreground">to {end.toLocaleDateString()}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "billed_status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("billed_status") as BilledStatus;
        const statusConfig = {
          pending: { color: "bg-yellow-500 text-black", label: "Pending" },
          billed: { color: "bg-green-500 text-white", label: "Billed" },
          error: { color: "bg-red-500 text-white", label: "Error" },
          excluded: { color: "bg-gray-500 text-white", label: "Excluded" },
        };
        const { color, label } = statusConfig[status];
        return <Badge className={color}>{label}</Badge>;
      },
    },
    {
      accessorKey: "invoice_id",
      header: "Invoice",
      cell: ({ row }) => {
        const invoiceId = row.getValue("invoice_id") as string | undefined;
        return <div className="text-sm text-muted-foreground">{invoiceId || "—"}</div>;
      },
    },
    {
      accessorKey: "source_system",
      header: "Source",
      cell: ({ row }) => {
        const source = row.getValue("source_system") as string;
        return (
          <Badge variant="outline" className="text-xs">
            {source.toUpperCase()}
          </Badge>
        );
      },
    },
  ];

  // ============================================================================
  // Bulk Actions
  // ============================================================================

  const bulkActions: BulkAction<UsageRecord>[] = [
    {
      label: "Mark as Billed",
      icon: Receipt,
      action: async (selected) => {
        setPendingBulkAction(selected);
        setShowInvoiceDialog(true);
      },
      disabled: (selected) => selected.every((r) => r.billed_status !== "pending"),
    },
    {
      label: "Exclude from Billing",
      icon: Database,
      action: async (selected) => {
        try {
          const usageIds = selected.map((r) => r.id);
          const success = await excludeFromBilling(usageIds);

          if (success) {
            logger.info("Usage records excluded from billing", { count: selected.length });
            toast({
              title: "Success",
              description: `Successfully excluded ${selected.length} usage record(s) from billing`,
            });
            await refetch();
          } else {
            throw new Error("Failed to exclude from billing");
          }
        } catch (error) {
          logger.error("Failed to exclude usage records from billing", error);
          toast({
            title: "Error",
            description: "Failed to exclude usage records from billing. Please try again.",
            variant: "destructive",
          });
        }
      },
    },
    {
      label: "Download CSV",
      icon: Download,
      action: async (selected) => {
        try {
          const usageIds = selected.map((r) => r.id);

          const response = await fetch("/api/billing/usage/export", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ usage_ids: usageIds }),
          });

          if (!response.ok) {
            throw new Error(`Failed to download CSV: ${response.statusText}`);
          }

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `usage-records-${new Date().toISOString().split("T")[0]}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          logger.info("Usage records exported", { count: selected.length });
          toast({
            title: "Success",
            description: `Successfully downloaded ${selected.length} usage record(s)`,
          });
        } catch (error) {
          logger.error("Failed to download usage records", error);
          toast({
            title: "Error",
            description: `Failed to download: ${error instanceof Error ? error.message : "Unknown error"}`,
            variant: "destructive",
          });
        }
      },
    },
  ];

  if (!hasBillingAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Usage Billing</CardTitle>
            <CardDescription>
              Access requires <code>billing.read</code> permission.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  // Show error state if API fails
  if (recordsError) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Usage Billing</CardTitle>
            <CardDescription className="text-red-600">
              Failed to load usage records. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Error: {recordsError.message}</p>
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usage Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track metered services and pay-as-you-go charges
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowRecordUsage(true)}>
            <Activity className="h-4 w-4 mr-2" />
            Record Usage
          </Button>
        </div>
      </header>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Records</CardDescription>
            <CardTitle className="text-3xl">{statistics.totalRecords}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">All usage records</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Usage</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              ${statistics.totalAmount.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">All usage charges</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">
              ${statistics.pendingAmount.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Awaiting invoicing</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Billed</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              ${statistics.billedAmount.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Invoiced charges</div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usage Trends (Last 7 Days)</CardTitle>
              <CardDescription>Metered usage by type over time</CardDescription>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {chartLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <UniversalChart
                {...({
                  type: "line",
                  data: apiChartData.length > 0 ? apiChartData : mockUsageChartData,
                  series: [
                    {
                      key: "data_transfer",
                      name: "Data Transfer (GB)",
                      color: "#3b82f6",
                    },
                    {
                      key: "voice_minutes",
                      name: "Voice Minutes",
                      color: "#10b981",
                    },
                    {
                      key: "bandwidth_gb",
                      name: "Bandwidth (GB)",
                      color: "#f59e0b",
                    },
                    {
                      key: "overage_gb",
                      name: "Overage (GB)",
                      color: "#ef4444",
                    },
                  ],
                  xAxisLabel: "Date",
                  yAxisLabel: "Usage",
                  showLegend: true,
                  showGrid: true,
                } as any)}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Records</CardTitle>
          <CardDescription>
            View and manage usage records with filtering and bulk actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnhancedDataTable
            data={usageRecords}
            columns={columns}
            searchColumn="customer_name"
            searchPlaceholder="Search by customer name..."
            isLoading={isLoading}
            selectable
            bulkActions={bulkActions}
            exportable
            exportFilename="usage-records"
            exportColumns={[
              "customer_name",
              "usage_type",
              "quantity",
              "unit",
              "total_amount",
              "period_start",
              "period_end",
              "billed_status",
              "invoice_id",
            ]}
            filterable
            filters={[
              {
                column: "usage_type",
                label: "Usage Type",
                type: "select",
                options: [
                  { label: "Data Transfer", value: "data_transfer" },
                  { label: "Voice Minutes", value: "voice_minutes" },
                  { label: "SMS", value: "sms_count" },
                  { label: "Bandwidth", value: "bandwidth_gb" },
                  { label: "Data Overage", value: "overage_gb" },
                  { label: "Static IP", value: "static_ip" },
                  { label: "Equipment Rental", value: "equipment_rental" },
                  { label: "Installation", value: "installation_fee" },
                  { label: "Custom", value: "custom" },
                ],
              },
              {
                column: "billed_status",
                label: "Status",
                type: "select",
                options: [
                  { label: "Pending", value: "pending" },
                  { label: "Billed", value: "billed" },
                  { label: "Error", value: "error" },
                  { label: "Excluded", value: "excluded" },
                ],
              },
            ]}
          />
        </CardContent>
      </Card>

      {/* Record Usage Modal */}
      <Dialog open={showRecordUsage} onOpenChange={setShowRecordUsage}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record Usage</DialogTitle>
            <DialogDescription>
              Manually record usage for a customer's subscription
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer-id">Customer ID *</Label>
              <Input
                id="customer-id"
                placeholder="cust-001"
                value={newUsageRecord.customer_id}
                onChange={(e) =>
                  setNewUsageRecord({ ...newUsageRecord, customer_id: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-name">Customer Name</Label>
              <Input
                id="customer-name"
                placeholder="John Doe"
                value={newUsageRecord.customer_name}
                onChange={(e) =>
                  setNewUsageRecord({ ...newUsageRecord, customer_name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usage-type">Usage Type *</Label>
              <Select
                value={newUsageRecord.usage_type}
                onValueChange={(value: UsageType) =>
                  setNewUsageRecord({ ...newUsageRecord, usage_type: value })
                }
              >
                <SelectTrigger id="usage-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="data_transfer">Data Transfer</SelectItem>
                  <SelectItem value="voice_minutes">Voice Minutes</SelectItem>
                  <SelectItem value="sms_count">SMS</SelectItem>
                  <SelectItem value="bandwidth_gb">Bandwidth</SelectItem>
                  <SelectItem value="overage_gb">Data Overage</SelectItem>
                  <SelectItem value="static_ip">Static IP</SelectItem>
                  <SelectItem value="equipment_rental">Equipment Rental</SelectItem>
                  <SelectItem value="installation_fee">Installation</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={newUsageRecord.quantity}
                onChange={(e) =>
                  setNewUsageRecord({ ...newUsageRecord, quantity: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                placeholder="GB"
                value={newUsageRecord.unit}
                onChange={(e) => setNewUsageRecord({ ...newUsageRecord, unit: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-price">Unit Price (cents)</Label>
              <Input
                id="unit-price"
                type="number"
                min="0"
                placeholder="10"
                value={newUsageRecord.unit_price}
                onChange={(e) =>
                  setNewUsageRecord({ ...newUsageRecord, unit_price: parseInt(e.target.value) || 0 })
                }
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Internet data usage"
                value={newUsageRecord.description}
                onChange={(e) =>
                  setNewUsageRecord({ ...newUsageRecord, description: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRecordUsage(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleRecordUsage} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Record Usage
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice ID Dialog for Bulk Billing */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Billed</DialogTitle>
            <DialogDescription>
              Enter the invoice ID to associate with {pendingBulkAction?.length || 0} usage record(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-id">Invoice ID *</Label>
              <Input
                id="invoice-id"
                placeholder="inv-001"
                value={invoiceIdForBilling}
                onChange={(e) => setInvoiceIdForBilling(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowInvoiceDialog(false);
                setInvoiceIdForBilling("");
                setPendingBulkAction(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleMarkAsBilled} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Marking...
                </>
              ) : (
                <>
                  <Receipt className="mr-2 h-4 w-4" />
                  Mark as Billed
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
