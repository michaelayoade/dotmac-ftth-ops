"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EnhancedDataTable, BulkAction } from "@/components/ui/EnhancedDataTable";
import { createSortableHeader } from "@/components/ui/data-table";
import { FileText, Download, X, CheckCircle, RefreshCw, DollarSign } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useRBAC } from "@/contexts/RBACContext";
import { apiClient } from "@/lib/api/client";

// ============================================================================
// Types
// ============================================================================

type CreditNoteStatus = "draft" | "issued" | "applied" | "partially_applied" | "voided";
type CreditReason =
  | "correction"
  | "goodwill"
  | "service_credit"
  | "billing_error"
  | "refund"
  | "other";

interface CreditNote {
  credit_note_id: string;
  credit_note_number?: string;
  customer_id: string;
  invoice_id?: string;
  status: CreditNoteStatus;
  reason: CreditReason;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  remaining_credit_amount: number;
  issue_date: string;
  notes?: string;
  internal_notes?: string;
  created_at: string;
  created_by: string;
  voided_at?: string;
  voided_by?: string;
  void_reason?: string;
  auto_apply_to_invoice: boolean;
}

// ============================================================================
// Mock Data (Replace with API)
// ============================================================================

const mockCreditNotes: CreditNote[] = [
  {
    credit_note_id: "cn-001",
    credit_note_number: "CN-2025-001",
    customer_id: "cust-001",
    invoice_id: "inv-001",
    status: "issued",
    reason: "service_credit",
    currency: "USD",
    subtotal: -10000, // -$100.00
    tax_amount: -1000, // -$10.00
    total_amount: -11000, // -$110.00
    remaining_credit_amount: -11000,
    issue_date: new Date().toISOString(),
    notes: "Service outage compensation",
    created_at: new Date().toISOString(),
    created_by: "user-001",
    auto_apply_to_invoice: true,
  },
  {
    credit_note_id: "cn-002",
    credit_note_number: "CN-2025-002",
    customer_id: "cust-002",
    invoice_id: "inv-002",
    status: "partially_applied",
    reason: "billing_error",
    currency: "USD",
    subtotal: -5000,
    tax_amount: -500,
    total_amount: -5500,
    remaining_credit_amount: -2500,
    issue_date: new Date(Date.now() - 86400000).toISOString(),
    notes: "Incorrect charges on invoice",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    created_by: "user-002",
    auto_apply_to_invoice: false,
  },
  {
    credit_note_id: "cn-003",
    credit_note_number: "CN-2025-003",
    customer_id: "cust-003",
    status: "draft",
    reason: "goodwill",
    currency: "USD",
    subtotal: -2500,
    tax_amount: -250,
    total_amount: -2750,
    remaining_credit_amount: -2750,
    issue_date: new Date().toISOString(),
    notes: "Customer satisfaction gesture",
    created_at: new Date().toISOString(),
    created_by: "user-001",
    auto_apply_to_invoice: false,
  },
];

// ============================================================================
// Component
// ============================================================================

export default function CreditNotesPage() {
  const { hasPermission } = useRBAC();
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(mockCreditNotes);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNote | null>(null);

  const hasBillingAccess = hasPermission("billing.read");

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalIssued = creditNotes.filter((cn) => cn.status === "issued").length;
    const totalDraft = creditNotes.filter((cn) => cn.status === "draft").length;
    const totalAvailableCredit = creditNotes
      .filter((cn) => cn.status === "issued" || cn.status === "partially_applied")
      .reduce((sum, cn) => sum + Math.abs(cn.remaining_credit_amount), 0);
    const totalApplied = creditNotes.filter((cn) => cn.status === "applied").length;

    return {
      totalIssued,
      totalDraft,
      totalAvailableCredit: totalAvailableCredit / 100, // Convert to dollars
      totalApplied,
    };
  }, [creditNotes]);

  // ============================================================================
  // Table Configuration
  // ============================================================================

  const columns: ColumnDef<CreditNote>[] = [
    {
      accessorKey: "credit_note_number",
      header: createSortableHeader("Credit Note #"),
      cell: ({ row }) => (
        <div className="font-medium">
          {row.getValue("credit_note_number") || row.original.credit_note_id}
        </div>
      ),
    },
    {
      accessorKey: "customer_id",
      header: "Customer",
      cell: ({ row }) => <div className="text-sm">{row.getValue("customer_id")}</div>,
    },
    {
      accessorKey: "total_amount",
      header: createSortableHeader("Amount"),
      cell: ({ row }) => {
        const amount = row.getValue("total_amount") as number;
        const currency = row.original.currency;
        const displayAmount = Math.abs(amount) / 100;
        return (
          <div className="font-medium text-green-600">
            -{currency} ${displayAmount.toFixed(2)}
          </div>
        );
      },
    },
    {
      accessorKey: "remaining_credit_amount",
      header: createSortableHeader("Available Credit"),
      cell: ({ row }) => {
        const amount = row.getValue("remaining_credit_amount") as number;
        const currency = row.original.currency;
        const displayAmount = Math.abs(amount) / 100;
        return (
          <div className="text-sm">
            {currency} ${displayAmount.toFixed(2)}
          </div>
        );
      },
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => {
        const reason = row.getValue("reason") as CreditReason;
        const reasonLabels: Record<CreditReason, string> = {
          correction: "Correction",
          goodwill: "Goodwill",
          service_credit: "Service Credit",
          billing_error: "Billing Error",
          refund: "Refund",
          other: "Other",
        };
        return <div className="text-sm">{reasonLabels[reason]}</div>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as CreditNoteStatus;
        const statusConfig = {
          draft: { color: "bg-gray-500 text-white", label: "Draft" },
          issued: { color: "bg-blue-500 text-white", label: "Issued" },
          applied: { color: "bg-green-500 text-white", label: "Applied" },
          partially_applied: {
            color: "bg-yellow-500 text-black",
            label: "Partially Applied",
          },
          voided: { color: "bg-red-500 text-white", label: "Voided" },
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
      accessorKey: "issue_date",
      header: createSortableHeader("Issue Date"),
      cell: ({ row }) => {
        const date = new Date(row.getValue("issue_date"));
        return <div className="text-sm">{date.toLocaleDateString()}</div>;
      },
    },
  ];

  // ============================================================================
  // Bulk Actions
  // ============================================================================

  const bulkActions: BulkAction<CreditNote>[] = [
    {
      label: "Issue Credit Notes",
      icon: CheckCircle,
      action: async (selected) => {
        setIsLoading(true);
        try {
          // Issue credit notes via API
          const promises = selected.map((cn) =>
            apiClient.post(`/billing/credit-notes/${cn.credit_note_id}/issue`, {}),
          );
          await Promise.all(promises);

          // Update local state
          setCreditNotes((prev) =>
            prev.map((cn) =>
              selected.find((s) => s.credit_note_id === cn.credit_note_id)
                ? { ...cn, status: "issued" as CreditNoteStatus }
                : cn,
            ),
          );

          alert(`Successfully issued ${selected.length} credit note(s)`);
        } catch (error) {
          console.error("Failed to issue credit notes:", error);
          alert(
            `Failed to issue credit notes: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        } finally {
          setIsLoading(false);
        }
      },
      disabled: (selected) => selected.every((cn) => cn.status !== "draft"),
    },
    {
      label: "Void Credit Notes",
      icon: X,
      variant: "destructive",
      action: async (selected) => {
        setIsLoading(true);
        try {
          // Void credit notes via API
          const promises = selected.map((cn) =>
            apiClient.post(`/billing/credit-notes/${cn.credit_note_id}/void`, {
              void_reason: "Voided via bulk action",
            }),
          );
          await Promise.all(promises);

          // Update local state
          setCreditNotes((prev) =>
            prev.map((cn) =>
              selected.find((s) => s.credit_note_id === cn.credit_note_id)
                ? {
                    ...cn,
                    status: "voided" as CreditNoteStatus,
                    voided_at: new Date().toISOString(),
                    void_reason: "Voided via bulk action",
                  }
                : cn,
            ),
          );

          alert(`Successfully voided ${selected.length} credit note(s)`);
        } catch (error) {
          console.error("Failed to void credit notes:", error);
          alert(
            `Failed to void credit notes: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        } finally {
          setIsLoading(false);
        }
      },
      confirmMessage:
        "Are you sure you want to void these credit notes? This action cannot be undone.",
    },
    {
      label: "Download CSV",
      icon: Download,
      action: async (selected) => {
        try {
          // Prepare credit note IDs for download
          const creditNoteIds = selected.map((cn) => cn.credit_note_id);

          // Call API to generate CSV
          const response = await fetch("/api/billing/credit-notes/export", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ credit_note_ids: creditNoteIds }),
          });

          if (!response.ok) {
            throw new Error(`Failed to download CSV: ${response.statusText}`);
          }

          // Get the CSV blob
          const blob = await response.blob();

          // Create a download link and trigger download
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `credit-notes-${new Date().toISOString().split("T")[0]}.csv`;
          document.body.appendChild(link);
          link.click();

          // Cleanup
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          alert(`Successfully downloaded ${selected.length} credit note(s)`);
        } catch (error) {
          console.error("Failed to download credit notes:", error);
          alert(`Failed to download: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      },
    },
  ];

  if (!hasBillingAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Credit Notes</CardTitle>
            <CardDescription>
              Access requires <code>billing.read</code> permission.
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
          <h1 className="text-3xl font-bold text-foreground">Credit Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage customer credits, refunds, and billing adjustments
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()} variant="outline" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Create Credit Note
          </Button>
        </div>
      </header>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Issued</CardDescription>
            <CardTitle className="text-3xl">{statistics.totalIssued}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Active credit notes</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Draft</CardDescription>
            <CardTitle className="text-3xl">{statistics.totalDraft}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Awaiting approval</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Available Credit</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              ${statistics.totalAvailableCredit.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Ready to apply</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Applied</CardDescription>
            <CardTitle className="text-3xl">{statistics.totalApplied}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Fully applied credits</div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Notes Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Credit Notes</CardTitle>
          <CardDescription>
            View and manage credit notes with filtering and bulk actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnhancedDataTable
            data={creditNotes}
            columns={columns}
            searchColumn="credit_note_number"
            searchPlaceholder="Search by credit note number..."
            isLoading={isLoading}
            selectable
            bulkActions={bulkActions}
            exportable
            exportFilename="credit-notes"
            exportColumns={[
              "credit_note_number",
              "customer_id",
              "total_amount",
              "remaining_credit_amount",
              "reason",
              "status",
              "issue_date",
            ]}
            filterable
            filters={[
              {
                column: "status",
                label: "Status",
                type: "select",
                options: [
                  { label: "Draft", value: "draft" },
                  { label: "Issued", value: "issued" },
                  { label: "Applied", value: "applied" },
                  { label: "Partially Applied", value: "partially_applied" },
                  { label: "Voided", value: "voided" },
                ],
              },
              {
                column: "reason",
                label: "Reason",
                type: "select",
                options: [
                  { label: "Correction", value: "correction" },
                  { label: "Goodwill", value: "goodwill" },
                  { label: "Service Credit", value: "service_credit" },
                  { label: "Billing Error", value: "billing_error" },
                  { label: "Refund", value: "refund" },
                  { label: "Other", value: "other" },
                ],
              },
            ]}
            onRowClick={(creditNote) => {
              // Open credit note detail modal
              setSelectedCreditNote(creditNote);
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
