"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Invoice } from "@/types/billing";
import { formatCurrency } from "@/lib/utils";
import { useInvoiceActions } from "@/hooks/useInvoiceActions";
import { Receipt } from "lucide-react";

interface CreateCreditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onSuccess?: () => void;
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
}: CreateCreditNoteModalProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const { createCreditNote, isCreatingCreditNote } = useInvoiceActions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const creditAmount = parseFloat(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      alert("Please enter a valid amount greater than 0");
      return;
    }

    if (creditAmount > invoice.amount_due) {
      const confirmed = confirm(
        `The credit amount (${formatCurrency(creditAmount)}) is greater than the amount due (${formatCurrency(invoice.amount_due)}). Continue anyway?`
      );
      if (!confirmed) return;
    }

    if (!reason) {
      alert("Please select a reason for the credit note");
      return;
    }

    try {
      await createCreditNote.mutateAsync({
        invoice_id: invoice.invoice_id,
        amount: creditAmount,
        reason,
        notes: notes || undefined,
      });

      // Reset form
      setAmount("");
      setReason("");
      setNotes("");

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      // Error handling is done in the hook
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
              <span className="font-medium">{formatCurrency(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Due:</span>
              <span className="font-medium text-primary">
                {formatCurrency(invoice.amount_due)}
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
              disabled={isCreatingCreditNote}
            />
            <p className="text-xs text-muted-foreground">
              Maximum: {formatCurrency(invoice.total_amount)}
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason} disabled={isCreatingCreditNote}>
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
              disabled={isCreatingCreditNote}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isCreatingCreditNote}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreatingCreditNote}>
              {isCreatingCreditNote ? "Creating..." : "Create Credit Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
