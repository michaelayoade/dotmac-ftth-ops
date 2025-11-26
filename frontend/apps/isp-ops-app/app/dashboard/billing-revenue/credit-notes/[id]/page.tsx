"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Calendar,
  User,
  DollarSign,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { CreditNote } from "@/types/billing";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
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
import { Separator } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { formatCurrency } from "@dotmac/features/billing";
import { useToast } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";

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

export default function CreditNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();

  const creditNoteId = params["id"] as string;

  const [creditNote, setCreditNote] = useState<CreditNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog states
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyInvoiceId, setApplyInvoiceId] = useState("");
  const [applyAmount, setApplyAmount] = useState("");

  const fetchCreditNote = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get(`/billing/credit-notes/${creditNoteId}`);
      if (response.data) {
        setCreditNote(response.data as CreditNote);
      } else {
        throw new Error("Failed to fetch credit note");
      }
    } catch (err) {
      console.error("Failed to fetch credit note:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch credit note";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [creditNoteId]);

  useEffect(() => {
    fetchCreditNote();
  }, [fetchCreditNote]);

  const handleIssueCreditNote = useCallback(async () => {
    if (!creditNote) return;

    try {
      setActionLoading(true);

      await apiClient.post(`/billing/credit-notes/${creditNote.id}/issue`);

      toast({
        title: "Credit note issued",
        description: "The credit note has been issued successfully.",
      });

      await fetchCreditNote();
    } catch (err) {
      console.error("Failed to issue credit note:", err);
      toast({
        title: "Error",
        description: "Failed to issue credit note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }, [creditNote, fetchCreditNote, toast]);

  const handleVoidCreditNote = useCallback(async () => {
    if (!creditNote) return;

    const confirmed = await confirmDialog({
      title: "Void credit note",
      description: "Are you sure you want to void this credit note? This action cannot be undone.",
      confirmText: "Void credit note",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(true);

      await apiClient.post(`/billing/credit-notes/${creditNote.id}/void`);

      toast({
        title: "Credit note voided",
        description: "The credit note has been voided successfully.",
      });

      await fetchCreditNote();
    } catch (err) {
      console.error("Failed to void credit note:", err);
      toast({
        title: "Error",
        description: "Failed to void credit note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }, [creditNote, confirmDialog, fetchCreditNote, toast]);

  const handleApplyCreditNote = useCallback(async () => {
    if (!creditNote) return;

    try {
      setActionLoading(true);

      const payload: { invoice_id?: string; amount?: number } = {};
      if (applyInvoiceId) {
        payload.invoice_id = applyInvoiceId;
      }
      if (applyAmount) {
        payload.amount = parseFloat(applyAmount);
      }

      await apiClient.post(`/billing/credit-notes/${creditNote.id}/apply`, payload);

      toast({
        title: "Credit note applied",
        description: "The credit note has been applied successfully.",
      });

      setApplyDialogOpen(false);
      setApplyInvoiceId("");
      setApplyAmount("");

      await fetchCreditNote();
    } catch (err) {
      console.error("Failed to apply credit note:", err);
      toast({
        title: "Error",
        description: "Failed to apply credit note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }, [creditNote, applyInvoiceId, applyAmount, fetchCreditNote, toast]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="rounded-lg border border-border bg-card p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading credit note...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !creditNote) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="rounded-lg border border-red-900/20 bg-red-950/20 p-4">
          <div className="text-red-600 dark:text-red-400">{error || "Credit note not found"}</div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={fetchCreditNote}
              className="text-sm text-red-700 hover:text-red-600 dark:text-red-300 dark:hover:text-red-200"
            >
              Try again
            </button>
            <button
              onClick={() => router.push("/dashboard/billing-revenue/credit-notes")}
              className="text-sm text-red-700 hover:text-red-600 dark:text-red-300 dark:hover:text-red-200"
            >
              Back to credit notes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/billing-revenue/credit-notes")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {creditNote.credit_note_number}
          </h1>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                creditNote.status === "applied"
                  ? "success"
                  : creditNote.status === "void"
                    ? "destructive"
                    : creditNote.status === "draft"
                      ? "secondary"
                      : "default"
              }
            >
              {creditNote.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {reasonLabels[creditNote.reason] || creditNote.reason}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {creditNote.status === "draft" && (
            <Button onClick={handleIssueCreditNote} disabled={actionLoading}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Issue
            </Button>
          )}
          {creditNote.status === "issued" && creditNote.available_credit > 0 && (
            <Button onClick={() => setApplyDialogOpen(true)} disabled={actionLoading}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Apply to Invoice
            </Button>
          )}
          {(creditNote.status === "draft" || creditNote.status === "issued") && (
            <Button variant="destructive" onClick={handleVoidCreditNote} disabled={actionLoading}>
              <XCircle className="h-4 w-4 mr-2" />
              Void
            </Button>
          )}
          <Button variant="outline" disabled={actionLoading}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Invoice ID</div>
                  <div className="font-medium">{creditNote.invoice_id}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(`/dashboard/billing-revenue/invoices/${creditNote.invoice_id}`)
                  }
                >
                  View Invoice
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditNote.line_items.map((item, index) => (
                    <TableRow key={item.line_item_id || index}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity || 1}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.amount, creditNote.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(creditNote.total_amount, creditNote.currency)}</span>
                </div>
                {creditNote.applied_amount > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Applied</span>
                    <span>-{formatCurrency(creditNote.applied_amount, creditNote.currency)}</span>
                  </div>
                )}
                {creditNote.available_credit > 0 && (
                  <div className="flex justify-between text-sm font-medium text-green-600 dark:text-green-400">
                    <span>Available Credit</span>
                    <span>{formatCurrency(creditNote.available_credit, creditNote.currency)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {(creditNote.notes || creditNote.internal_notes) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {creditNote.notes && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Customer Notes
                    </div>
                    <div className="text-sm p-3 rounded-lg bg-muted/50">{creditNote.notes}</div>
                  </div>
                )}
                {creditNote.internal_notes && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Internal Notes
                    </div>
                    <div className="text-sm p-3 rounded-lg bg-muted/50 border border-amber-500/20">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <span>{creditNote.internal_notes}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Amount Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Amount Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Amount</span>
                <span className="font-medium">
                  {formatCurrency(creditNote.total_amount, creditNote.currency)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Applied</span>
                <span className="font-medium">
                  {formatCurrency(creditNote.applied_amount, creditNote.currency)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Available</span>
                <span className="font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(creditNote.available_credit, creditNote.currency)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <div className="text-sm text-muted-foreground">Customer ID</div>
                  <div className="font-medium text-sm">{creditNote.customer_id}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Trail */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Created</div>
                <div className="text-sm font-medium">
                  {new Date(creditNote.created_at).toLocaleString()}
                </div>
              </div>
              {creditNote.issued_at && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Issued</div>
                    <div className="text-sm font-medium">
                      {new Date(creditNote.issued_at).toLocaleString()}
                    </div>
                  </div>
                </>
              )}
              {creditNote.applied_at && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Applied</div>
                    <div className="text-sm font-medium">
                      {new Date(creditNote.applied_at).toLocaleString()}
                    </div>
                  </div>
                </>
              )}
              {creditNote.voided_at && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Voided</div>
                    <div className="text-sm font-medium text-red-600 dark:text-red-400">
                      {new Date(creditNote.voided_at).toLocaleString()}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Apply to Invoice Dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Credit Note to Invoice</DialogTitle>
            <DialogDescription>
              Apply the available credit to an invoice. Leave fields empty to apply to the original
              invoice.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="apply_invoice_id">Invoice ID (optional)</Label>
              <Input
                id="apply_invoice_id"
                value={applyInvoiceId}
                onChange={(e) => setApplyInvoiceId(e.target.value)}
                placeholder={creditNote.invoice_id}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to apply to the original invoice
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="apply_amount">Amount (optional)</Label>
              <Input
                id="apply_amount"
                type="number"
                step="0.01"
                value={applyAmount}
                onChange={(e) => setApplyAmount(e.target.value)}
                placeholder={creditNote.available_credit.toString()}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to apply full available credit (
                {formatCurrency(creditNote.available_credit, creditNote.currency)})
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApplyDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleApplyCreditNote} disabled={actionLoading}>
              {actionLoading ? "Applying..." : "Apply Credit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
