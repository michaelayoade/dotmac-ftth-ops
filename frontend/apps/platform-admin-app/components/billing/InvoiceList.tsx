"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Mail,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Invoice, InvoiceLineItem, InvoiceStatuses } from "@/types";
import {
  EnhancedDataTable,
  type ColumnDef,
  type BulkAction,
  type QuickFilter,
  type Row,
} from "@/components/ui/EnhancedDataTable";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { useRouter } from "next/navigation";

interface InvoiceListProps {
  tenantId: string;
  onInvoiceSelect?: (invoice: Invoice) => void;
}

const statusColors = {
  draft: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  finalized: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  paid: "bg-green-500/10 text-green-600 dark:text-green-400",
  void: "bg-red-500/10 text-red-600 dark:text-red-400",
  uncollectible: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
};

const paymentStatusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  processing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  paid: "bg-green-500/10 text-green-600 dark:text-green-400",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400",
  refunded: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

export default function InvoiceList({ tenantId, onInvoiceSelect }: InvoiceListProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (tenantId) {
        queryParams.set("tenant_id", tenantId);
      }

      const endpoint = `/billing/invoices${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const response = await apiClient.get(endpoint);
      if (response.data) {
        const data = response.data as { invoices?: Invoice[] };
        setInvoices(data.invoices || []);
      } else {
        throw new Error("Failed to fetch invoices");
      }
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch invoices";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Bulk operations
  const handleBulkSend = useCallback(
    async (selected: Invoice[]) => {
      setBulkLoading(true);
      try {
        const invoiceIds = selected.map((inv) => inv.invoice_id);
        await apiClient.post("/billing/invoices/bulk-send", {
          invoice_ids: invoiceIds,
        });
        alert(`Successfully sent ${invoiceIds.length} invoice(s)`);
        await fetchInvoices();
      } catch (err) {
        console.error("Failed to send invoices:", err);
        alert("Failed to send invoices. Please try again.");
      } finally {
        setBulkLoading(false);
      }
    },
    [fetchInvoices],
  );

  const handleBulkVoid = useCallback(
    async (selected: Invoice[]) => {
      if (
        !confirm(
          `Are you sure you want to void ${selected.length} invoice(s)? This cannot be undone.`,
        )
      ) {
        return;
      }

      setBulkLoading(true);
      try {
        const invoiceIds = selected.map((inv) => inv.invoice_id);
        await apiClient.post("/billing/invoices/bulk-void", {
          invoice_ids: invoiceIds,
        });
        alert(`Successfully voided ${invoiceIds.length} invoice(s)`);
        await fetchInvoices();
      } catch (err) {
        console.error("Failed to void invoices:", err);
        alert("Failed to void invoices. Please try again.");
      } finally {
        setBulkLoading(false);
      }
    },
    [fetchInvoices],
  );

  const handleBulkDownload = useCallback(async (selected: Invoice[]) => {
    setBulkLoading(true);
    try {
      const invoiceIds = selected.map((inv) => inv.invoice_id);
      const response = await apiClient.post(
        "/billing/invoices/bulk-download",
        { invoice_ids: invoiceIds },
        { responseType: "blob" },
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `invoices-${new Date().toISOString().split("T")[0]}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to download invoices:", err);
      alert("Failed to download invoices. Please try again.");
    } finally {
      setBulkLoading(false);
    }
  }, []);

  const handleCreateCreditNote = useCallback(
    (invoice: Invoice) => {
      router.push(`/tenant-portal/billing/credit-notes/new?invoice_id=${invoice.invoice_id}`);
    },
    [router],
  );

  // Column definitions
  const columns: ColumnDef<Invoice>[] = useMemo(
    () => [
      {
        id: "invoice_number",
        header: "Invoice #",
        accessorKey: "invoice_number",
        cell: ({ row }: { row: Row<Invoice> }) => (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{row.original.invoice_number}</span>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }: { row: Row<Invoice> }) => (
          <div>
            <div className="text-sm">{row.original.billing_email}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.customer_id.slice(0, 8)}...
            </div>
          </div>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }: { row: Row<Invoice> }) => (
          <div>
            <div className="font-medium">
              {formatCurrency(row.original.total_amount, row.original.currency || "USD")}
            </div>
            {row.original.amount_due > 0 && (
              <div className="text-xs text-muted-foreground">
                Due: {formatCurrency(row.original.amount_due, row.original.currency || "USD")}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "due_date",
        header: "Due Date",
        accessorKey: "due_date",
        cell: ({ row }: { row: Row<Invoice> }) => {
          const dueDate = new Date(row.original.due_date);
          const isOverdue = dueDate < new Date() && row.original.amount_due > 0;
          return (
            <div
              className={`flex items-center gap-1 ${isOverdue ? "text-red-600 dark:text-red-400" : ""}`}
            >
              <Calendar className="h-3 w-3" />
              {dueDate.toLocaleDateString()}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }: { row: Row<Invoice> }) => (
          <Badge
            variant={
              row.original.status === "paid"
                ? "success"
                : row.original.status === "void"
                  ? "destructive"
                  : row.original.status === "draft"
                    ? "secondary"
                    : "default"
            }
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "payment_status",
        header: "Payment",
        accessorKey: "payment_status",
        cell: ({ row }: { row: Row<Invoice> }) => (
          <Badge
            variant={
              row.original.payment_status === "paid"
                ? "success"
                : row.original.payment_status === "failed"
                  ? "destructive"
                  : row.original.payment_status === "processing"
                    ? "default"
                    : "secondary"
            }
          >
            {row.original.payment_status || "pending"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }: { row: Row<Invoice> }) => (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreateCreditNote(row.original);
              }}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Create credit note"
            >
              <CreditCard className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/billing/invoices/${row.original.invoice_id}/download`, "_blank");
              }}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Download invoice"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [handleCreateCreditNote],
  );

  // Bulk actions
  const bulkActions: BulkAction<Invoice>[] = useMemo(
    () => [
      {
        label: "Send Invoices",
        icon: Mail,
        action: handleBulkSend,
        disabled: (selected) => selected.every((inv) => inv.status === "void"),
      },
      {
        label: "Void Invoices",
        icon: XCircle,
        action: handleBulkVoid,
        disabled: (selected) =>
          selected.every((inv) => inv.status === "void" || inv.status === "paid"),
      },
      {
        label: "Download Selected",
        icon: Download,
        action: handleBulkDownload,
      },
    ],
    [handleBulkDownload, handleBulkSend, handleBulkVoid],
  );

  // Quick filters
  const quickFilters: QuickFilter<Invoice>[] = useMemo(
    () => [
      {
        label: "Overdue",
        filter: (invoice: Invoice) => {
          const dueDate = new Date(invoice.due_date);
          return dueDate < new Date() && invoice.amount_due > 0;
        },
      },
      {
        label: "Unpaid",
        filter: (invoice: Invoice) => invoice.amount_due > 0 && invoice.status !== "void",
      },
      {
        label: "This Month",
        filter: (invoice: Invoice) => {
          const createdDate = new Date(invoice.created_at);
          const now = new Date();
          return (
            createdDate.getMonth() === now.getMonth() &&
            createdDate.getFullYear() === now.getFullYear()
          );
        },
      },
      {
        label: "Paid",
        filter: (invoice: Invoice) => invoice.status === "paid",
      },
    ],
    [],
  );

  // Search configuration
  const searchConfig = {
    placeholder: "Search invoices by number, email, or customer ID...",
    searchableFields: ["invoice_number", "billing_email", "customer_id"] as (keyof Invoice)[],
  };

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalInvoices = invoices.length;
    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.amount_due, 0);
    const paidThisMonth = invoices
      .filter((inv) => {
        const createdDate = new Date(inv.created_at);
        const now = new Date();
        return (
          inv.payment_status === "paid" &&
          createdDate.getMonth() === now.getMonth() &&
          createdDate.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, inv) => sum + inv.amount_paid, 0);

    return { totalInvoices, totalOutstanding, paidThisMonth };
  }, [invoices]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading invoices...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/20 bg-red-950/20 p-4">
        <div className="text-red-600 dark:text-red-400">{error}</div>
        <button
          onClick={fetchInvoices}
          className="mt-2 text-sm text-red-700 hover:text-red-600 dark:text-red-300 dark:hover:text-red-200"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="invoice-table">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Invoices</div>
          <div className="text-2xl font-bold text-foreground">{statistics.totalInvoices}</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Outstanding</div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(statistics.totalOutstanding, "USD")}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground mb-1">Paid This Month</div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(statistics.paidThisMonth, "USD")}
          </div>
        </div>
      </div>

      {/* Enhanced Invoice Table */}
      <EnhancedDataTable
        data={invoices}
        columns={columns}
        bulkActions={bulkActions}
        quickFilters={quickFilters}
        searchConfig={searchConfig}
        onRowClick={onInvoiceSelect}
        isLoading={bulkLoading}
        emptyMessage="No invoices found"
        getRowId={(invoice: Invoice) => invoice.invoice_id}
      />
    </div>
  );
}
