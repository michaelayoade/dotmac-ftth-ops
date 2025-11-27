"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { RadioGroup, RadioGroupItem } from "@dotmac/ui";
import { TenantSubscription, SubscriptionCancelRequest } from "@/hooks/useTenantSubscription";
import { format } from "date-fns";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { logger } from "@/lib/logger";

interface CancelSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: TenantSubscription | null;
  onConfirmCancel: (request: SubscriptionCancelRequest) => Promise<void>;
  isCanceling?: boolean;
  error?: string | null;
}

const cancellationReasons = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "missing_features", label: "Missing features I need" },
  { value: "not_using", label: "Not using the service enough" },
  { value: "switching_competitor", label: "Switching to a competitor" },
  { value: "technical_issues", label: "Too many technical issues" },
  { value: "customer_service", label: "Poor customer service" },
  { value: "temporary_pause", label: "Need a temporary break" },
  { value: "other", label: "Other reason" },
];

export const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = ({
  open,
  onOpenChange,
  subscription,
  onConfirmCancel,
  isCanceling = false,
  error = null,
}) => {
  const [cancelationType, setCancelationType] = useState<"immediate" | "at_period_end">(
    "at_period_end",
  );
  const [reason, setReason] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [confirmationStep, setConfirmationStep] = useState<"details" | "confirm">("details");

  const resetForm = () => {
    setCancelationType("at_period_end");
    setReason("");
    setFeedback("");
    setConfirmationStep("details");
  };

  const handleNext = () => {
    if (confirmationStep === "details") {
      setConfirmationStep("confirm");
    }
  };

  const handleBack = () => {
    if (confirmationStep === "confirm") {
      setConfirmationStep("details");
    }
  };

  const handleConfirm = async () => {
    if (!subscription) return;

    try {
      const request: SubscriptionCancelRequest = {
        cancel_at_period_end: cancelationType === "at_period_end",
        ...(reason ? { reason } : {}),
        ...(feedback ? { feedback } : {}),
      };

      await onConfirmCancel(request);
      resetForm();
      onOpenChange(false);
    } catch (err) {
      logger.error(
        "Failed to cancel subscription",
        err instanceof Error ? err : new Error(String(err)),
        { subscriptionId: (subscription as any).id },
      );
    }
  };

  const calculateRefund = () => {
    if (!subscription || cancelationType === "at_period_end") return 0;

    // Simplified proration calculation
    const periodStart = new Date(subscription.current_period_start);
    const periodEnd = new Date(subscription.current_period_end);
    const now = new Date();

    const totalDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const remainingDays = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (remainingDays <= 0) return 0;

    const refundAmount = (subscription.price_amount * remainingDays) / totalDays;
    return Math.max(0, refundAmount);
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  if (!subscription) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Cancel Subscription
          </DialogTitle>
          <DialogDescription>
            {confirmationStep === "details"
              ? "We&apos;re sorry to see you go. Please help us understand why you&apos;re canceling."
              : "Please review and confirm your cancellation."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {confirmationStep === "details" && (
          <div className="space-y-6">
            {/* Cancellation Type */}
            <div className="space-y-3">
              <Label>When would you like to cancel?</Label>
              <RadioGroup
                value={cancelationType}
                onValueChange={(value: string) => setCancelationType(value as any)}
              >
                <div className="flex items-start space-x-3 rounded-md border p-4 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="at_period_end" id="at_period_end" className="mt-1" />
                  <label htmlFor="at_period_end" className="flex-1 cursor-pointer">
                    <div className="font-medium">Cancel at period end (Recommended)</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      You&apos;ll retain access until{" "}
                      {format(new Date(subscription.current_period_end), "MMM d, yyyy")}. No refund
                      will be issued.
                    </div>
                  </label>
                </div>

                <div className="flex items-start space-x-3 rounded-md border p-4 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="immediate" id="immediate" className="mt-1" />
                  <label htmlFor="immediate" className="flex-1 cursor-pointer">
                    <div className="font-medium">Cancel immediately</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Your subscription will end immediately.
                      {calculateRefund() > 0 && (
                        <span className="text-green-600 dark:text-green-400">
                          {" "}
                          Estimated refund:{" "}
                          {formatCurrency(calculateRefund(), subscription.currency)}
                        </span>
                      )}
                    </div>
                  </label>
                </div>
              </RadioGroup>
            </div>

            {/* Cancellation Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Why are you canceling? (Optional)</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {cancellationReasons.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Additional Feedback */}
            <div className="space-y-2">
              <Label htmlFor="feedback">Additional feedback (Optional)</Label>
              <Textarea
                id="feedback"
                placeholder="Tell us more about your experience or what we could improve..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">{feedback.length}/1000 characters</p>
            </div>

            {/* Immediate Cancellation Warning */}
            {cancelationType === "immediate" && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Immediate cancellation will end your access right away.
                  All data will be retained for 30 days in accordance with our data retention
                  policy.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {confirmationStep === "confirm" && (
          <div className="space-y-6">
            {/* Confirmation Summary */}
            <div className="rounded-md bg-muted p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Current Plan</span>
                <span className="text-sm font-medium">{subscription.plan_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Plan Price</span>
                <span className="text-sm font-medium">
                  {formatCurrency(subscription.price_amount, subscription.currency)} / month
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Cancellation Type</span>
                <span className="text-sm font-medium">
                  {cancelationType === "at_period_end" ? "At period end" : "Immediate"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  {cancelationType === "at_period_end" ? "Access Until" : "Cancels On"}
                </span>
                <span className="text-sm font-medium">
                  {cancelationType === "at_period_end"
                    ? format(new Date(subscription.current_period_end), "MMM d, yyyy")
                    : "Immediately"}
                </span>
              </div>
              {cancelationType === "immediate" && calculateRefund() > 0 && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Estimated Refund</span>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(calculateRefund(), subscription.currency)}
                  </span>
                </div>
              )}
            </div>

            {/* Data Retention Notice */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Data Retention:</strong> Your data will be retained for 30 days after
                cancellation. You can reactivate your subscription within this period to restore
                full access. After 30 days, your data will be permanently deleted.
              </AlertDescription>
            </Alert>

            {/* What You&apos;ll Lose */}
            <div className="space-y-2">
              <p className="text-sm font-medium">After cancellation, you&apos;ll lose access to:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-5 list-disc">
                <li>All subscription features and resources</li>
                <li>Active add-ons and integrations</li>
                <li>Ongoing support and updates</li>
                <li>Team collaboration features</li>
                {subscription.usage && (
                  <li>
                    Current usage data ({subscription.usage.users?.current || 0} users,{" "}
                    {((subscription.usage.storage?.current || 0) / 1024 / 1024 / 1024).toFixed(2)}{" "}
                    GB storage)
                  </li>
                )}
              </ul>
            </div>

            {/* Final Warning */}
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This action cannot be undone. Are you sure you want to cancel your subscription?
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {confirmationStep === "details" ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  onOpenChange(false);
                }}
                disabled={isCanceling}
              >
                Keep Subscription
              </Button>
              <Button variant="destructive" onClick={handleNext}>
                Continue to Cancellation
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBack} disabled={isCanceling}>
                Back
              </Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={isCanceling}>
                {isCanceling ? "Canceling..." : "Confirm Cancellation"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
