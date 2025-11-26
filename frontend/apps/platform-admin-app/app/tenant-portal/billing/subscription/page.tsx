"use client";

import React, { useState } from "react";
import {
  useTenantSubscription,
  AvailablePlan,
  type SubscriptionCancelRequest,
} from "@/hooks/useTenantSubscription";
import { SubscriptionCard } from "@/components/tenant/billing/SubscriptionCard";
import { PlanComparison } from "@/components/tenant/billing/PlanComparison";
import { UpgradeModal } from "@/components/tenant/billing/UpgradeModal";
import { CancelSubscriptionModal } from "@/components/tenant/billing/CancelSubscriptionModal";
import { SubscriptionPageSkeleton } from "@/components/tenant/billing/SkeletonLoaders";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { AlertCircle, CreditCard, Receipt, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function SubscriptionPage() {
  const {
    subscription,
    availablePlans,
    prorationPreview,
    loading,
    error,
    fetchAvailablePlans,
    previewPlanChange,
    changePlan,
    cancelSubscription,
    reactivateSubscription,
  } = useTenantSubscription();

  const [selectedPlan, setSelectedPlan] = useState<AvailablePlan | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Fetch available plans on mount
  React.useEffect(() => {
    if (availablePlans.length === 0) {
      fetchAvailablePlans();
    }
  }, [availablePlans.length, fetchAvailablePlans]);

  const handleSelectPlan = async (plan: AvailablePlan) => {
    setSelectedPlan(plan);
    setModalError(null);
    setUpgradeModalOpen(true);

    // Load proration preview
    setIsLoadingPreview(true);
    try {
      await previewPlanChange({
        new_plan_id: plan.plan_id,
        billing_cycle: plan.billing_cycle,
      });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      setModalError(e.message || "Failed to load pricing preview");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlan) return;

    setIsChangingPlan(true);
    setModalError(null);

    try {
      await changePlan({
        new_plan_id: selectedPlan.plan_id,
        billing_cycle: selectedPlan.billing_cycle,
      });
      setUpgradeModalOpen(false);
      setSelectedPlan(null);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      setModalError(e.message || "Failed to change plan");
    } finally {
      setIsChangingPlan(false);
    }
  };

  const handleCancelSubscription = async (request: unknown) => {
    setIsCanceling(true);
    setModalError(null);

    try {
      await cancelSubscription(request as SubscriptionCancelRequest);
      setCancelModalOpen(false);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      setModalError(e.message || "Failed to cancel subscription");
    } finally {
      setIsCanceling(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      await reactivateSubscription();
    } catch (err: unknown) {
      console.error("Failed to reactivate subscription:", err);
    }
  };

  if (loading && !subscription) {
    return <SubscriptionPageSkeleton />;
  }

  if (error && !subscription) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Subscription Management</h1>
        <p className="text-muted-foreground">Manage your subscription plan and billing.</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/tenant-portal/billing/payment-methods">
          <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Payment Methods</p>
                <p className="text-sm text-muted-foreground">Manage payment options</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/tenant-portal/billing/invoices">
          <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Receipt className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Billing History</p>
                <p className="text-sm text-muted-foreground">View invoices & receipts</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/tenant-portal/billing/addons">
          <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Add-ons</p>
                <p className="text-sm text-muted-foreground">Browse marketplace</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Current Subscription */}
      {subscription && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Current Subscription</h2>
          <SubscriptionCard
            subscription={subscription}
            onUpgrade={() => {
              // Scroll to plans section
              document.getElementById("available-plans")?.scrollIntoView({ behavior: "smooth" });
            }}
            onCancel={() => setCancelModalOpen(true)}
            onReactivate={handleReactivateSubscription}
          />
        </div>
      )}

      {/* Available Plans */}
      {availablePlans.length > 0 && (
        <div className="space-y-4" id="available-plans">
          <div>
            <h2 className="text-2xl font-semibold">Available Plans</h2>
            <p className="text-muted-foreground mt-1">
              Upgrade or downgrade your plan at any time. Changes are prorated.
            </p>
          </div>
          <PlanComparison
            plans={availablePlans}
            {...(subscription?.plan_id ? { currentPlanId: subscription.plan_id } : {})}
            onSelectPlan={handleSelectPlan}
          />
        </div>
      )}

      {/* Billing History Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>Your billing history and payment records</CardDescription>
            </div>
            <Link href="/tenant-portal/billing/invoices">
              <Button variant="outline">View All</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No recent invoices to display</p>
            <p className="text-sm mt-1">Your billing history will appear here</p>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        selectedPlan={selectedPlan}
        prorationPreview={prorationPreview}
        isLoadingPreview={isLoadingPreview}
        isChangingPlan={isChangingPlan}
        error={modalError}
        onConfirm={handleConfirmUpgrade}
      />

      <CancelSubscriptionModal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        subscription={subscription}
        onConfirmCancel={handleCancelSubscription}
        isCanceling={isCanceling}
        error={modalError}
      />
    </div>
  );
}
