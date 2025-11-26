/**
 * Tenant Subscription Management Page
 *
 * View and manage subscription, add-ons, and usage
 */

"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import {
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useLicensing } from "../../../hooks/useLicensing";
import { SubscriptionDashboard } from "../../../components/licensing/SubscriptionDashboard";
import { PlanSelector } from "../../../components/licensing/PlanSelector";
import { BillingCycle, ModuleCategory } from "../../../types/licensing";
import type {
  ServicePlan as BillingServicePlan,
  TenantSubscription as BillingTenantSubscription,
  SubscriptionStatus as BillingSubscriptionStatus,
} from "@dotmac/features/billing";

export default function TenantSubscriptionPage() {
  const {
    plans,
    plansLoading,
    plansError,
    currentSubscription,
    subscriptionLoading,
    subscriptionError,
    createSubscription,
  } = useLicensing();

  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingServicePlan | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>(
    BillingCycle.MONTHLY,
  );
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleSelectPlan = (plan: BillingServicePlan, billingCycle: BillingCycle) => {
    setSelectedPlan(plan);
    setSelectedBillingCycle(billingCycle);
    setShowPlanSelector(true);
  };

  const planOptions = useMemo<BillingServicePlan[]>(() => {
    return plans.map((plan) => {
      const mappedPlan: BillingServicePlan = {
        id: plan.id,
        plan_name: plan.plan_name,
        plan_code: plan.plan_code,
        description: plan.description ?? "",
        base_price_monthly: plan.base_price_monthly ?? 0,
        annual_discount_percent: plan.annual_discount_percent ?? 0,
        trial_days: plan.trial_days ?? 0,
        is_public: plan.is_public ?? false,
        is_active: plan.is_active ?? false,
        created_at: plan.created_at ?? "",
        updated_at: plan.updated_at ?? "",
      };

      if (plan.modules && plan.modules.length > 0) {
        mappedPlan.modules = plan.modules.map((module) => ({
          id: module.id,
          module_id: module.module_id,
          included_by_default: module.included_by_default,
          addon_price: module.override_price ?? 0,
          module: module.module
            ? {
                id: module.module.id,
                module_name: module.module.module_name ?? "",
                module_code: module.module.module_code ?? "",
                description: module.module.description ?? "",
                category: (module.module.category as string | undefined) ?? "uncategorized",
                is_core: !module.is_optional_addon,
                dependencies: module.module.dependencies ?? [],
                created_at: module.module.created_at ?? "",
                updated_at: module.module.updated_at ?? "",
              }
            : undefined,
        })) as NonNullable<BillingServicePlan["modules"]>;
      }

      if (plan.quotas && plan.quotas.length > 0) {
        mappedPlan.quotas = plan.quotas.map((quota) => ({
          id: quota.id,
          quota_id: quota.quota_id,
          included_quantity: quota.included_quantity,
          overage_allowed: quota.allow_overage,
          overage_rate: quota.overage_rate_override,
          quota: quota.quota
            ? {
                id: quota.quota.id,
                quota_name: quota.quota.quota_name,
                quota_code: quota.quota.quota_code,
                unit_name: quota.quota.unit_name,
                description: quota.quota.description,
              }
            : undefined,
        })) as NonNullable<BillingServicePlan["quotas"]>;
      }

      return mappedPlan;
    });
  }, [plans]);

  const sharedSubscription = useMemo<BillingTenantSubscription | null>(() => {
    if (!currentSubscription) {
      return null;
    }

    const subscriptionPlan = planOptions.find((plan) => plan.id === currentSubscription.plan_id);

    const subscriptionData: BillingTenantSubscription = {
      id: currentSubscription.id,
      tenant_id: currentSubscription.tenant_id,
      plan_id: currentSubscription.plan_id,
      status: currentSubscription.status as BillingSubscriptionStatus,
      billing_cycle: currentSubscription.billing_cycle as BillingCycle,
      monthly_price: currentSubscription.monthly_price,
      current_period_start: currentSubscription.current_period_start,
      current_period_end: currentSubscription.current_period_end,
      created_at: currentSubscription.created_at,
      updated_at: currentSubscription.updated_at,
    };

    if (currentSubscription.modules && currentSubscription.modules.length > 0) {
      subscriptionData.modules = currentSubscription.modules.map((module) => {
        const mappedModule: NonNullable<BillingTenantSubscription["modules"]>[number] = {
          id: module.id,
          module_id: module.module_id,
          source:
            module.source === "ADDON"
              ? "ADDON"
              : module.source === "TRIAL"
                ? "TRIAL"
                : "PLAN",
        };

        if (module.addon_price !== undefined) {
          mappedModule.addon_price = module.addon_price;
        }

        if (module.module) {
          const moduleCategory =
            (module.module.category as ModuleCategory | undefined) ?? ModuleCategory.OTHER;
          mappedModule.module = {
            id: module.module.id,
            module_name: module.module.module_name ?? "",
            module_code: module.module.module_code ?? "",
            description: module.module.description ?? "",
            category: moduleCategory,
            is_core: true,
            dependencies: module.module.dependencies ?? [],
            created_at: module.module.created_at ?? "",
            updated_at: module.module.updated_at ?? "",
          };
        }

        return mappedModule;
      });
    }

    if (currentSubscription.quota_usage && currentSubscription.quota_usage.length > 0) {
      subscriptionData.quota_usage = currentSubscription.quota_usage.map((usage) => {
        const mappedQuota: NonNullable<BillingTenantSubscription["quota_usage"]>[number] = {
          id: usage.id,
          quota_id: usage.quota_id,
          allocated_quantity: usage.allocated_quantity,
          current_usage: usage.current_usage,
          overage_quantity: usage.overage_quantity,
          overage_charges: usage.overage_charges,
        };

        if (usage.quota) {
          mappedQuota.quota = {
            id: usage.quota.id,
            quota_name: usage.quota.quota_name ?? "",
            quota_code: usage.quota.quota_code ?? "",
            unit_name: usage.quota.unit_name ?? "",
            description: usage.quota.description ?? "",
          };
        }

        return mappedQuota;
      });
    }

    if (currentSubscription.trial_end) {
      subscriptionData.trial_end = currentSubscription.trial_end;
    }

    if (subscriptionPlan) {
      subscriptionData.plan = subscriptionPlan;
    }

    return subscriptionData;
  }, [currentSubscription, planOptions]);

  const handleConfirmPlan = async () => {
    if (!selectedPlan) return;

    setIsUpgrading(true);
    try {
      // Get tenant_id from auth context or API
      const tenantId = "current"; // This would come from auth context

      await createSubscription({
        tenant_id: tenantId,
        plan_id: selectedPlan.id,
        billing_cycle: selectedBillingCycle,
        start_trial: selectedPlan.trial_days > 0,
      });

      setShowPlanSelector(false);
      setSelectedPlan(null);
    } catch (error) {
      console.error("Failed to create subscription:", error);
    } finally {
      setIsUpgrading(false);
    }
  };

  // Loading state
  if (subscriptionLoading || plansLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (subscriptionError || plansError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscription</h1>
          <p className="text-muted-foreground">Manage your subscription and billing</p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load subscription details. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No subscription - show plan selector
  if (!currentSubscription) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Choose Your Plan</h1>
          <p className="text-muted-foreground">Select a plan that fits your business needs</p>
        </div>

        <PlanSelector plans={planOptions} onSelectPlan={handleSelectPlan} loading={isUpgrading} />

        {/* Confirm Dialog */}
        <Dialog open={showPlanSelector} onOpenChange={setShowPlanSelector}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Subscription</DialogTitle>
              <DialogDescription>
                You&apos;re about to subscribe to {selectedPlan?.plan_name}
              </DialogDescription>
            </DialogHeader>

            {selectedPlan && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Plan:</span>
                    <span>{selectedPlan.plan_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Billing:</span>
                    <span>{selectedBillingCycle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Price:</span>
                    <span className="text-lg font-bold">
                      ${selectedPlan.base_price_monthly.toFixed(2)}/month
                    </span>
                  </div>
                  {selectedPlan.trial_days > 0 && (
                    <Alert>
                      <AlertDescription>
                        Includes a {selectedPlan.trial_days} day free trial
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPlanSelector(false)}
                disabled={isUpgrading}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmPlan} disabled={isUpgrading}>
                {isUpgrading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Subscribing...
                  </>
                ) : (
                  "Confirm Subscription"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (!sharedSubscription) {
    return null;
  }

  // Has subscription - show dashboard
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and billing</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plans">Available Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SubscriptionDashboard
            subscription={sharedSubscription}
            onUpgrade={() => {
              // Navigate to plans tab or show upgrade modal
            }}
            onManageAddons={() => {
              // Show add-ons management modal
            }}
            onViewUsage={() => {
              // Navigate to usage details
            }}
            onManageBilling={() => {
              // Navigate to billing settings
            }}
          />
        </TabsContent>

        <TabsContent value="plans">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upgrade Your Plan</CardTitle>
                <CardDescription>
                  Choose a different plan to unlock more features and resources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PlanSelector
                  plans={planOptions}
                  currentPlanId={sharedSubscription.plan_id}
                  onSelectPlan={handleSelectPlan}
                  loading={isUpgrading}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
