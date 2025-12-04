"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  FileText,
  Calendar,
  Search,
  RefreshCw,
  Download,
  XCircle,
  CheckCircle,
  DollarSign,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { CreditNote, CreditNoteStatuses } from "@/types/billing";
import { EnhancedDataTable, type ColumnDef, type QuickFilter, type Row } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { formatCurrency } from "@dotmac/features/billing";
import { useRouter } from "next/navigation";
import { useToast } from "@dotmac/ui";
import { useTenant } from "@/lib/contexts/tenant-context";

const statusColors = {
  draft: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  issued: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  applied: "bg-green-500/10 text-green-600 dark:text-green-400",
  void: "bg-red-500/10 text-red-600 dark:text-red-400",
  refunded: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

const reasonLabels = {
  error: "Error",
  discount: "Discount",
  return: "Return",
  goodwill: "Goodwill",
  other: "Other",
};

interface CreditNoteFormData {
  invoice_id: string;
  reason: string;
  amount: string;
  description: string;
  notes: string;
  internal_notes: string;
  auto_apply: boolean;
}

export default function CreditNotesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState<CreditNoteFormData>({
    invoice_id: "",
    reason: "error",
    amount: "",
    description: "",
    notes: "",
    internal_notes: "",
    auto_apply: false,
  });

  const fetchCreditNotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get("/billing/credit-notes/");
      if (response.data) {
        const data = response.data as { credit_notes?: CreditNote[]; items?: CreditNote[] };
        setCreditNotes(data.credit_notes || data.items || []);
      } else {
        throw new Error("Failed to fetch credit notes");
      }
    } catch (err) {
      console.error("Failed to fetch credit notes:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch credit notes";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCreditNotes();
  }, [fetchCreditNotes]);

  const handleCreateCreditNote = useCallback(async () => {
    try {
      setCreating(true);

      const lineItems = [
        {
          description: formData["description"],
          amount: parseFloat(formData["amount"]),
        },
      ];

      const payload = {
        invoice_id: formData["invoice_id"],
        reason: formData.reason,
        line_items: lineItems,
        notes: formData.notes || null,
        internal_notes: formData.internal_notes || null,
        auto_apply: formData.auto_apply,
      };

      await apiClient.post("/billing/credit-notes/", payload);

      toast({
        title: "Credit note created",
        description: "The credit note has been created successfully.",
      });

      setCreateDialogOpen(false);
      setFormData({
        invoice_id: "",
        reason: "error",
        amount: "",
        description: "",
        notes: "",
        internal_notes: "",
        auto_apply: false,
      });

      await fetchCreditNotes();
    } catch (err) {
      console.error("Failed to create credit note:", err);
      toast({
        title: "Error",
        description: "Failed to create credit note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }, [formData, fetchCreditNotes, toast]);

  // Column definitions
  const columns: ColumnDef<CreditNote>[] = useMemo(
    () => [
      {
        id: "credit_note_number",
        header: "Credit Note #",
        accessorKey: "credit_note_number",
        cell: ({ row }: { row: Row<CreditNote> }) => (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{row.original.credit_note_number}</span>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }: { row: Row<CreditNote> }) => (
          <div>
            <div className="text-sm font-medium">{row.original.customer_id.slice(0, 8)}...</div>
          </div>
        ),
      },
      {
        id: "invoice",
        header: "Invoice",
        cell: ({ row }: { row: Row<CreditNote> }) => (
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{row.original.invoice_id.slice(0, 8)}...</span>
          </div>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }: { row: Row<CreditNote> }) => (
          <div>
            <div className="font-medium">
              {formatCurrency(row.original.total_amount, row.original.currency || "USD")}
            </div>
            {row.original.available_credit > 0 && (
              <div className="text-xs text-muted-foreground">
                Available:{" "}
                {formatCurrency(row.original.available_credit, row.original.currency || "USD")}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }: { row: Row<CreditNote> }) => (
          <Badge
            variant={
              row.original.status === "applied"
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
        id: "reason",
        header: "Reason",
        cell: ({ row }: { row: Row<CreditNote> }) => (
          <span className="text-sm text-muted-foreground">
            {reasonLabels[row.original.reason] || row.original.reason}
          </span>
        ),
      },
      {
        id: "date",
        header: "Date",
        cell: ({ row }: { row: Row<CreditNote> }) => {
          const date = new Date(row.original.created_at);
          return (
            <div className="flex items-center gap-1 text-sm">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              {date.toLocaleDateString()}
            </div>
          );
        },
      },
    ],
    [],
  );

  // Quick filters
  const quickFilters: QuickFilter<CreditNote>[] = useMemo(
    () => [
      {
        label: "Draft",
        filter: (cn: CreditNote) => cn.status === "draft",
      },
      {
        label: "Issued",
        filter: (cn: CreditNote) => cn.status === "issued",
      },
      {
        label: "Applied",
        filter: (cn: CreditNote) => cn.status === "applied",
      },
      {
        label: "Available Credit",
        filter: (cn: CreditNote) => cn.available_credit > 0,
      },
    ],
    [],
  );

  // Search configuration
  const searchConfig = {
    placeholder: "Search credit notes by number, customer, or invoice...",
    searchableFields: ["credit_note_number", "customer_id", "invoice_id"] as (keyof CreditNote)[],
  };

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalCredits = creditNotes.reduce((sum, cn) => sum + cn.total_amount, 0);
    const availableCredit = creditNotes.reduce((sum, cn) => sum + cn.available_credit, 0);
    const appliedCredit = creditNotes.reduce((sum, cn) => sum + cn.applied_amount, 0);

    return { totalCredits, availableCredit, appliedCredit };
  }, [creditNotes]);

  const handleRowClick = useCallback(
    (creditNote: CreditNote) => {
      router.push(`/dashboard/billing-revenue/credit-notes/${creditNote.id}`);
    },
    [router],
  );

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="rounded-lg border border-border bg-card p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading credit notes...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="rounded-lg border border-red-900/20 bg-red-950/20 p-4">
          <div className="text-red-600 dark:text-red-400">{error}</div>
          <button
            onClick={fetchCreditNotes}
            className="mt-2 text-sm text-red-700 hover:text-red-600 dark:text-red-300 dark:hover:text-red-200"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Credit Notes</h1>
          <p className="text-muted-foreground">
            Manage customer credit notes, refunds, and adjustments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setCreateDialogOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Credit Note
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            <span>Total Credits</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(statistics.totalCredits, "USD")}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span>Available Credit</span>
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(statistics.availableCredit, "USD")}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <XCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>Applied Credit</span>
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(statistics.appliedCredit, "USD")}
          </div>
        </div>
      </div>

      {/* Credit Notes Table */}
      <EnhancedDataTable
        data={creditNotes}
        columns={columns}
        quickFilters={quickFilters}
        searchConfig={searchConfig}
        onRowClick={handleRowClick}
        emptyMessage="No credit notes found"
        getRowId={(creditNote: CreditNote) => creditNote.id}
      />

      {/* Create Credit Note Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Credit Note</DialogTitle>
            <DialogDescription>Create a new credit note for a customer invoice.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="invoice_id">Invoice ID</Label>
              <Input
                id="invoice_id"
                value={formData["invoice_id"]}
                onChange={(e) => setFormData({ ...formData, invoice_id: e.target.value })}
                placeholder="Enter invoice ID"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Select
                value={formData.reason}
                onValueChange={(value) => setFormData({ ...formData, reason: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="discount">Discount</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                  <SelectItem value="goodwill">Goodwill</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData["amount"]}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData["description"]}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description of the credit"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Customer Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes visible to customer"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="internal_notes">Internal Notes</Label>
              <Textarea
                id="internal_notes"
                value={formData.internal_notes}
                onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                placeholder="Internal notes (not visible to customer)"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_apply"
                checked={formData.auto_apply}
                onChange={(e) => setFormData({ ...formData, auto_apply: e.target.checked })}
                className="rounded border-border"
              />
              <Label htmlFor="auto_apply" className="cursor-pointer">
                Automatically apply to invoice
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateCreditNote} disabled={creating}>
              {creating ? "Creating..." : "Create Credit Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
