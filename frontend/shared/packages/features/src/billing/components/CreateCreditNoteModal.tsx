/**
 * Shared Create Credit Note Modal
 *
 * Modal for creating credit notes against invoices.
 */

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";
import { Receipt } from "lucide-react";
import { useState } from "react";

import { type Invoice } from "../types";
import { formatCurrency } from "../utils";

export interface CreateCreditNoteData {
  invoice_id: string;
  amount: number;
  reason: string;
  notes?: string;
}

export interface CreateCreditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onSuccess?: () => void;
  onCreateCreditNote: (data: CreateCreditNoteData) => Promise<void>;
  isCreating?: boolean;
}

const CREDIT_NOTE_REASONS = [
  { value: "duplicate", label: "Duplicate Charge" },
  { value: "error", label: "Billing Error" },
  { value: "refund", label: "Customer Refund" },
  { value: "discount", label: "Discount Applied" },
  { value: "service_issue", label: "Service Issue" },
  { value: "goodwill", label: "Goodwill Gesture" },
  { value: "other", label: "Other" },
];

export function CreateCreditNoteModal({
  isOpen,
  onClose,
  invoice,
  onSuccess,
  onCreateCreditNote,
  isCreating = false,
}: CreateCreditNoteModalProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const confirmDialog = useConfirmDialog();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const creditAmount = parseFloat(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      alert("Please enter a valid amount greater than 0");
      return;
    }

    if (creditAmount > invoice.amount_due) {
      const confirmed = await confirmDialog({
        title: "Confirm credit amount",
        description: `The credit amount (${formatCurrency(creditAmount, invoice.currency || "USD")}) is greater than the amount due (${formatCurrency(invoice.amount_due, invoice.currency || "USD")}). Continue anyway?`,
        confirmText: "Continue",
      });
      if (!confirmed) return;
    }

    if (!reason) {
      alert("Please select a reason for the credit note");
      return;
    }

    try {
      const payload: CreateCreditNoteData = {
        invoice_id: invoice.invoice_id,
        amount: creditAmount,
        reason,
      };
      if (notes.trim()) {
        payload.notes = notes.trim();
      }

      await onCreateCreditNote(payload);

      // Reset form
      setAmount("");
      setReason("");
      setNotes("");

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      // Error handling is done by the caller
    }
  };

  const handleCancel = () => {
    setAmount("");
    setReason("");
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Create Credit Note
          </DialogTitle>
          <DialogDescription>
            Create a credit note for invoice {invoice.invoice_number}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Invoice Summary */}
          <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoice Number:</span>
              <span className="font-medium">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Amount:</span>
              <span className="font-medium">
                {formatCurrency(invoice.total_amount, invoice.currency || "USD")}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Due:</span>
              <span className="font-medium text-primary">
                {formatCurrency(invoice.amount_due, invoice.currency || "USD")}
              </span>
            </div>
          </div>

          {/* Credit Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Credit Amount <span className="text-destructive">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={invoice.total_amount}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              Maximum: {formatCurrency(invoice.total_amount, invoice.currency || "USD")}
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason} disabled={isCreating}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {CREDIT_NOTE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional: Provide additional details about this credit note..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={isCreating}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Credit Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
