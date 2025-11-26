"use client";

import { useState } from "react";
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
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useBankAccounts, useManualPayments } from "@/hooks/useBankAccounts";
import {
  useStartReconciliation,
  useAddReconciledPayment,
  useCompleteReconciliation,
} from "@/hooks/useReconciliation";
import { Badge } from "@dotmac/ui";
import { Checkbox } from "@dotmac/ui";
import type { ReconciliationStart } from "@/lib/services/reconciliation-service";

interface ReconciliationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type WizardStep = "setup" | "matching" | "review" | "complete";

interface ReconciliationSetupState {
  bank_account_id: string;
  period_start: string;
  period_end: string;
  statement_balance: string;
  notes: string;
}

export function ReconciliationWizard({
  open,
  onOpenChange,
  onComplete,
}: ReconciliationWizardProps) {
  const [step, setStep] = useState<WizardStep>("setup");
  const [reconciliationId, setReconciliationId] = useState<number | null>(null);

  // Setup form data
  const [setupData, setSetupData] = useState<ReconciliationSetupState>({
    bank_account_id: "",
    period_start: new Date(new Date().setDate(1)).toISOString().slice(0, 10),
    period_end: new Date().toISOString().slice(0, 10),
    statement_balance: "",
    notes: "",
  });

  // Matching data
  const [selectedPayments, setSelectedPayments] = useState<number[]>([]);

  // Hooks
  const { data: bankAccounts } = useBankAccounts(false);
  const { data: unReconciledPayments } = useManualPayments({
    payment_status: "completed",
    date_from: setupData.period_start,
    date_to: setupData.period_end,
  });
  const startReconciliation = useStartReconciliation();
  const addReconciledPayment = useAddReconciledPayment();
  const completeReconciliation = useCompleteReconciliation();

  const handleStartReconciliation = async () => {
    try {
      const bankAccountId = Number.parseInt(setupData.bank_account_id, 10);
      const statementBalance = Number.parseFloat(setupData.statement_balance);

      if (Number.isNaN(bankAccountId) || Number.isNaN(statementBalance)) {
        return;
      }

      const notesValue = setupData.notes.trim();
      const data: ReconciliationStart = {
        bank_account_id: bankAccountId,
        period_start: setupData.period_start,
        period_end: setupData.period_end,
        opening_balance: statementBalance,
        statement_balance: statementBalance,
        ...(notesValue && { notes: notesValue }),
      };

      const result = await startReconciliation.mutateAsync(data);
      setReconciliationId(result.id);
      setStep("matching");
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleReconcilePayments = async () => {
    if (!reconciliationId) return;

    try {
      // Reconcile each selected payment
      for (const paymentId of selectedPayments) {
        await addReconciledPayment.mutateAsync({
          reconciliationId,
          paymentData: {
            payment_id: paymentId,
          },
        });
      }

      setStep("review");
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleCompleteReconciliation = async () => {
    if (!reconciliationId) return;

    try {
      const notesValue = setupData.notes.trim();
      await completeReconciliation.mutateAsync({
        reconciliationId,
        data: {
          ...(notesValue && { notes: notesValue }),
        },
      });

      setStep("complete");
      setTimeout(() => {
        handleClose();
        onComplete?.();
      }, 2000);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleClose = () => {
    setStep("setup");
    setReconciliationId(null);
    setSelectedPayments([]);
    setSetupData({
      bank_account_id: "",
      period_start: new Date(new Date().setDate(1)).toISOString().slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10),
      statement_balance: "",
      notes: "",
    });
    onOpenChange(false);
  };

  const togglePaymentSelection = (paymentId: number) => {
    setSelectedPayments((prev) =>
      prev.includes(paymentId) ? prev.filter((id) => id !== paymentId) : [...prev, paymentId],
    );
  };

  const calculateTotalSelected = () => {
    if (!unReconciledPayments) return 0;
    return unReconciledPayments
      .filter((p) => selectedPayments.includes(p.id))
      .reduce((sum, p) => sum + p.amount, 0);
  };

  const calculateDiscrepancy = () => {
    const statementBalance = parseFloat(setupData.statement_balance) || 0;
    const selectedTotal = calculateTotalSelected();
    return Math.abs(statementBalance - selectedTotal);
  };

  const isPending =
    startReconciliation.isPending ||
    addReconciledPayment.isPending ||
    completeReconciliation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "setup" && "Start Reconciliation"}
            {step === "matching" && "Match Payments"}
            {step === "review" && "Review Reconciliation"}
            {step === "complete" && "Reconciliation Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "setup" && "Configure the reconciliation period and bank account"}
            {step === "matching" && "Select payments that match your bank statement"}
            {step === "review" && "Review and complete the reconciliation"}
            {step === "complete" && "Reconciliation has been completed successfully"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Setup */}
        {step === "setup" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank_account_id">Bank Account *</Label>
              <Select
                value={setupData.bank_account_id}
                onValueChange={(value) => setSetupData({ ...setupData, bank_account_id: value })}
              >
                <SelectTrigger id="bank_account_id">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.account_nickname || account.account_name} (****
                      {account.account_number_last_four})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period_start">Period Start *</Label>
                <Input
                  id="period_start"
                  type="date"
                  value={setupData.period_start}
                  onChange={(e) => setSetupData({ ...setupData, period_start: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="period_end">Period End *</Label>
                <Input
                  id="period_end"
                  type="date"
                  value={setupData.period_end}
                  onChange={(e) => setSetupData({ ...setupData, period_end: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="statement_balance">Bank Statement Balance *</Label>
              <Input
                id="statement_balance"
                type="number"
                step="0.01"
                value={setupData.statement_balance}
                onChange={(e) =>
                  setSetupData({
                    ...setupData,
                    statement_balance: e.target.value,
                  })
                }
                required
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={setupData.notes}
                onChange={(e) => setSetupData({ ...setupData, notes: e.target.value })}
                placeholder="Add any notes about this reconciliation..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleStartReconciliation}
                disabled={
                  !setupData.bank_account_id ||
                  !setupData.period_start ||
                  !setupData.period_end ||
                  !setupData.statement_balance ||
                  isPending
                }
              >
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Next: Match Payments
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Matching */}
        {step === "matching" && (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Statement Balance:</span>
                <span className="text-lg font-bold">
                  ${parseFloat(setupData.statement_balance).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Selected Payments Total:</span>
                <span className="text-lg font-bold">${calculateTotalSelected().toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-2">
                <span className="text-sm font-medium">Discrepancy:</span>
                <span
                  className={`text-lg font-bold ${
                    calculateDiscrepancy() === 0 ? "text-green-600" : "text-orange-600"
                  }`}
                >
                  ${calculateDiscrepancy().toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Unreconciled Payments</Label>
              {!unReconciledPayments || unReconciledPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No unreconciled payments found for this period
                </div>
              ) : (
                <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                  {unReconciledPayments
                    .filter((p) => !p.reconciled)
                    .map((payment) => {
                      const isSelected = selectedPayments.includes(payment.id);
                      return (
                        <div
                          key={payment.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer"
                          onClick={() => togglePaymentSelection(payment.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onChange={(event) => {
                              event.stopPropagation();
                              togglePaymentSelection(payment.id);
                            }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Customer: {payment.customer_id}</span>
                              <span className="font-bold">
                                {payment.currency} {payment.amount.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{payment.payment_reference}</span>
                              <Badge variant="outline" className="text-xs">
                                {payment.payment_method}
                              </Badge>
                              <span>{new Date(payment.payment_date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleReconcilePayments}
                disabled={selectedPayments.length === 0 || isPending}
              >
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Next: Review ({selectedPayments.length} selected)
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Review */}
        {step === "review" && (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h3 className="font-semibold">Reconciliation Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Bank Account</span>
                  <p className="font-medium">
                    {
                      bankAccounts?.find((a) => a.id === parseInt(setupData.bank_account_id))
                        ?.account_name
                    }
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Period</span>
                  <p className="font-medium">
                    {new Date(setupData.period_start).toLocaleDateString()} -{" "}
                    {new Date(setupData.period_end).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Payments Reconciled</span>
                  <p className="font-medium">{selectedPayments.length}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Total Amount</span>
                  <p className="font-medium">${calculateTotalSelected().toFixed(2)}</p>
                </div>
              </div>

              {calculateDiscrepancy() > 0 && (
                <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-950 p-3 rounded border border-orange-200 dark:border-orange-800">
                  <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                      Discrepancy Detected
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300">
                      There is a ${calculateDiscrepancy().toFixed(2)} difference between the
                      statement balance and selected payments. Please verify before completing.
                    </p>
                  </div>
                </div>
              )}

              {calculateDiscrepancy() === 0 && (
                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    Perfect match! No discrepancies found.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCompleteReconciliation} disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Complete Reconciliation
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <h3 className="text-xl font-semibold">Reconciliation Complete</h3>
            <p className="text-muted-foreground text-center">
              Successfully reconciled {selectedPayments.length} payment(s) totaling $
              {calculateTotalSelected().toFixed(2)}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
