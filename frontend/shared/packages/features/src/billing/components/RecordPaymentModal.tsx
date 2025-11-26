"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { DollarSign, CreditCard, Building2, Wallet, Check, Upload, X } from "lucide-react";
import { useState, useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

export type PaymentMethod =
  | "bank_transfer"
  | "card"
  | "cash"
  | "check"
  | "stripe"
  | "paypal"
  | "other";

export interface RecordPaymentInvoice {
  invoice_id: string;
  invoice_number: string;
  amount_due: number;
  due_date: string;
}

export interface PaymentFormData {
  amount: string;
  method: PaymentMethod;
  reference: string;
  description: string;
  payment_date: string;
  receipt_file?: File;
  apply_to_invoices: { invoice_id: string; amount: number }[];
}

export interface BillingApiClient {
  post: <T = any>(url: string, data?: any, config?: any) => Promise<{ data: T }>;
}

export interface Toast {
  toast: (options: {
    title: string;
    description: string;
    variant?: "default" | "destructive";
  }) => void;
}

export interface Logger {
  error: (message: string, error: Error, context?: any) => void;
}

export interface BillingConfirmDialogFn {
  (options: {
    title: string;
    description: string;
    confirmText?: string;
    variant?: "destructive" | "default";
  }): Promise<boolean>;
}

export interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: RecordPaymentInvoice[];
  onSuccess?: () => void;
  apiClient: BillingApiClient;
  useToast: () => Toast;
  logger: Logger;
  useConfirmDialog: () => BillingConfirmDialogFn;
  formatCurrency: (amount: number) => string;
}

// ============================================================================
// Component
// ============================================================================

export function RecordPaymentModal({
  isOpen,
  onClose,
  invoices,
  onSuccess,
  apiClient,
  useToast,
  logger,
  useConfirmDialog,
  formatCurrency,
}: RecordPaymentModalProps) {
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Form state
  const [formData, setFormData] = useState<PaymentFormData>({
    amount: "",
    method: "bank_transfer",
    reference: "",
    description: "",
    payment_date: new Date().toISOString().split("T")[0] ?? "",
    apply_to_invoices: [],
  });

  // Calculate total amount due from selected invoices
  const totalAmountDue = useMemo(() => {
    return invoices.reduce((sum, invoice) => sum + invoice.amount_due, 0);
  }, [invoices]);

  // Auto-fill amount with total due
  useState(() => {
    if (totalAmountDue > 0 && !formData.amount) {
      setFormData((prev) => ({ ...prev, amount: totalAmountDue.toFixed(2) }));
    }
  });

  // Calculate how payment amount should be distributed across invoices
  const paymentDistribution = useMemo(() => {
    const paymentAmount = parseFloat(formData.amount) || 0;

    if (paymentAmount <= 0) return [];

    // Sort invoices by due date (oldest first)
    const sortedInvoices = [...invoices].sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    );

    let remainingAmount = paymentAmount;
    const distribution: { invoice: RecordPaymentInvoice; amount: number }[] = [];

    for (const invoice of sortedInvoices) {
      if (remainingAmount <= 0) break;

      const amountToApply = Math.min(remainingAmount, invoice.amount_due);

      distribution.push({
        invoice,
        amount: amountToApply,
      });

      remainingAmount -= amountToApply;
    }

    return distribution;
  }, [formData.amount, invoices]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Receipt file must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      // Validate file type
      const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Only JPEG, PNG, and PDF files are allowed",
          variant: "destructive",
        });
        return;
      }

      setReceiptFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let paymentPayload: any = null;

    try {
      // Explicit validation (not relying on HTML5 required attributes)
      if (!formData.amount || formData.amount.trim() === "") {
        toast({
          title: "Validation Error",
          description: "Payment amount is required",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (!formData.payment_date) {
        toast({
          title: "Validation Error",
          description: "Payment date is required",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (!formData.method) {
        toast({
          title: "Validation Error",
          description: "Payment method is required",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const paymentAmount = parseFloat(formData.amount);

      // Validation
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        toast({
          title: "Invalid Amount",
          description: "Payment amount must be a valid number greater than zero",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (paymentAmount > totalAmountDue) {
        const confirmed = await confirmDialog({
          title: "Confirm overpayment",
          description: `Payment amount (${formatCurrency(paymentAmount)}) exceeds total amount due (${formatCurrency(totalAmountDue)}). Continue anyway?`,
          confirmText: "Record payment",
        });
        if (!confirmed) {
          setIsSubmitting(false);
          return;
        }
      }

      // Build payment data
      const payload = {
        amount: paymentAmount,
        method: formData.method,
        reference: formData.reference,
        description: formData.description || `Payment for ${invoices.length} invoice(s)`,
        payment_date: formData.payment_date,
        apply_to_invoices: paymentDistribution.map((dist) => ({
          invoice_id: dist.invoice.invoice_id,
          amount: dist.amount,
        })),
      };

      paymentPayload = payload;

      // Record payment via API
      try {
        // If receipt file is provided, upload it first
        let receiptUrl: string | undefined;
        if (receiptFile) {
          const formData = new FormData();
          formData.append("file", receiptFile);

          const uploadResponse = await apiClient.post("/billing/receipts/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });

          receiptUrl = uploadResponse.data?.url;
        }

        // Record payment with receipt URL
        await apiClient.post("/billing/payments", {
          ...payload,
          receipt_url: receiptUrl,
        });

        toast({
          title: "Payment Recorded",
          description: `Payment of ${formatCurrency(payload.amount)} has been successfully recorded.`,
        });
      } catch (error) {
        logger.error(
          "Failed to record payment (submission)",
          error instanceof Error ? error : new Error(String(error)),
          { invoiceIds: payload.apply_to_invoices, amount: paymentAmount },
        );
        toast({
          title: "Payment Failed",
          description:
            error instanceof Error ? error.message : "Failed to record payment. Please try again.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Reset form
      setFormData({
        amount: "",
        method: "bank_transfer",
        reference: "",
        description: "",
        payment_date: new Date().toISOString().split("T")[0] ?? "",
        apply_to_invoices: [],
      });
      setReceiptFile(null);

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      logger.error(
        "Failed to record payment (outer)",
        error instanceof Error ? error : new Error(String(error)),
        { amount: formData.amount },
      );
      toast({
        title: "Error",
        description: "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case "card":
      case "stripe":
        return <CreditCard className="h-4 w-4" />;
      case "bank_transfer":
        return <Building2 className="h-4 w-4" />;
      case "cash":
      case "check":
        return <Wallet className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Record Payment
          </DialogTitle>
          <DialogDescription>Record a payment received from the customer</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invoice Summary */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Applying Payment To:</h3>
              <Badge variant="outline">{invoices.length} Invoice(s)</Badge>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {invoices.map((invoice) => (
                <div key={invoice.invoice_id} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs">{invoice.invoice_number}</span>
                  <span className="text-muted-foreground">
                    Due: {formatCurrency(invoice.amount_due)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <span className="font-medium">Total Amount Due:</span>
              <span className="text-lg font-bold">{formatCurrency(totalAmountDue)}</span>
            </div>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="amount">
                Payment Amount <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="pl-9"
                  placeholder="0.00"
                  required
                />
              </div>
              {parseFloat(formData.amount) > totalAmountDue && (
                <p className="text-xs text-amber-400">
                  Warning: Payment exceeds total amount due. Overpayment will be credited to
                  customer account.
                </p>
              )}
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="method">
                Payment Method <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.method}
                onValueChange={(value) =>
                  setFormData({ ...formData, method: value as PaymentMethod })
                }
              >
                <SelectTrigger id="method">
                  <div className="flex items-center gap-2">
                    {getPaymentMethodIcon(formData.method)}
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Bank Transfer
                    </div>
                  </SelectItem>
                  <SelectItem value="card">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Credit/Debit Card
                    </div>
                  </SelectItem>
                  <SelectItem value="cash">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Cash
                    </div>
                  </SelectItem>
                  <SelectItem value="check">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Check
                    </div>
                  </SelectItem>
                  <SelectItem value="stripe">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Stripe
                    </div>
                  </SelectItem>
                  <SelectItem value="paypal">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      PayPal
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Other
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_date">
                Payment Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                max={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference Number</Label>
              <Input
                id="reference"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="e.g., Check #1234, Transfer ID"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="description">Description/Notes</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional notes about this payment..."
                rows={3}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="receipt">Attach Receipt (Optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="receipt"
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("receipt")?.click()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {receiptFile ? receiptFile.name : "Upload Receipt"}
                </Button>
                {receiptFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setReceiptFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Accepted formats: JPEG, PNG, PDF (max 5MB)
              </p>
            </div>
          </div>

          {/* Payment Distribution Preview */}
          {paymentDistribution.length > 0 && (
            <div className="rounded-lg border p-4 bg-muted/50">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                Payment Distribution Preview
              </h3>
              <div className="space-y-2">
                {paymentDistribution.map((dist) => (
                  <div
                    key={dist.invoice.invoice_id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-mono text-xs">{dist.invoice.invoice_number}</span>
                    <span className="font-medium text-emerald-400">
                      {formatCurrency(dist.amount)}
                    </span>
                  </div>
                ))}
                {parseFloat(formData.amount) > totalAmountDue && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Credit to Account</span>
                    <span className="font-medium text-amber-400">
                      {formatCurrency(parseFloat(formData.amount) - totalAmountDue)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
