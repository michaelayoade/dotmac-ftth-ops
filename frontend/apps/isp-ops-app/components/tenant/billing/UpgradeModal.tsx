"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
import { AvailablePlan, ProrationPreview } from "@/hooks/useTenantSubscription";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { format } from "date-fns";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPlan: AvailablePlan | null;
  prorationPreview: ProrationPreview | null;
  isLoadingPreview: boolean;
  isChangingPlan: boolean;
  error: string | null;
  onConfirm: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  open,
  onOpenChange,
  selectedPlan,
  prorationPreview,
  isLoadingPreview,
  isChangingPlan,
  error,
  onConfirm,
}) => {
  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  if (!selectedPlan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Change Subscription Plan</DialogTitle>
          <DialogDescription>
            Review the details of your plan change before confirming
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* Plan Change Summary */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
            {prorationPreview ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <p className="font-medium">{prorationPreview.current_plan.name}</p>
                  <p className="text-sm">
                    {formatCurrency(prorationPreview.current_plan.price)} /{" "}
                    {prorationPreview.current_plan.billing_cycle}
                  </p>
                </div>

                <ArrowRight className="w-5 h-5 text-muted-foreground" />

                <div>
                  <p className="text-sm text-muted-foreground">New Plan</p>
                  <p className="font-medium">{prorationPreview.new_plan.name}</p>
                  <p className="text-sm">
                    {formatCurrency(prorationPreview.new_plan.price)} /{" "}
                    {prorationPreview.new_plan.billing_cycle}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">New Plan</p>
                <p className="font-medium">{selectedPlan.display_name || selectedPlan.name}</p>
                <p className="text-sm">
                  {formatCurrency(selectedPlan.price_amount, selectedPlan.currency)} /{" "}
                  {selectedPlan.billing_cycle}
                </p>
              </div>
            )}
          </div>

          {/* Proration Breakdown */}
          {isLoadingPreview ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Calculating proration...</span>
            </div>
          ) : (
            prorationPreview && (
              <div className="space-y-3">
                <Separator />

                <div>
                  <p className="text-sm font-medium mb-2">Proration Details</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unused time on current plan</span>
                      <span>
                        {formatCurrency(prorationPreview.proration.old_plan_unused_amount)}{" "}
                        <span className="text-green-600">credit</span>
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prorated charge for new plan</span>
                      <span>
                        {formatCurrency(prorationPreview.proration.new_plan_prorated_amount)}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Days remaining in period</span>
                      <span>{prorationPreview.proration.days_remaining} days</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Amount Due Today */}
                <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5">
                  <span className="font-medium">Amount due today</span>
                  <span className="text-2xl font-bold">
                    {formatCurrency(prorationPreview.proration.proration_amount)}
                  </span>
                </div>

                {/* Next Billing */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Next billing date</span>
                  <span>{format(new Date(prorationPreview.next_billing_date), "MMM d, yyyy")}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Next invoice amount</span>
                  <span>{formatCurrency(prorationPreview.estimated_invoice_amount)}</span>
                </div>

                {/* Info Message */}
                <Alert>
                  <AlertDescription className="text-sm">
                    {prorationPreview.proration.proration_description ||
                      "Your plan change will take effect immediately. You will be charged the prorated amount today."}
                  </AlertDescription>
                </Alert>
              </div>
            )
          )}

          {/* Features Preview (if not loading) */}
          {!isLoadingPreview &&
            selectedPlan.features &&
            Object.keys(selectedPlan.features).length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">What you&apos;ll get:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {Object.entries(selectedPlan.features)
                    .slice(0, 5)
                    .map(([key, value]) => (
                      <li key={key} className="flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mr-2" />
                        {key.replace(/_/g, " ")}: {String(value)}
                      </li>
                    ))}
                </ul>
              </div>
            )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isChangingPlan}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoadingPreview || isChangingPlan || !!error}>
            {isChangingPlan ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Changing Plan...
              </>
            ) : (
              "Confirm Change"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
