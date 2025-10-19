/**
 * Tenant Subscription Management Page
 *
 * View and manage subscription, add-ons, and usage
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useLicensing } from '../../../hooks/useLicensing';
import { SubscriptionDashboard } from '../../../components/licensing/SubscriptionDashboard';
import { PlanSelector } from '../../../components/licensing/PlanSelector';
import { BillingCycle, ServicePlan } from '../../../types/licensing';

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
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>(
    BillingCycle.MONTHLY
  );
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleSelectPlan = (plan: ServicePlan, billingCycle: BillingCycle) => {
    setSelectedPlan(plan);
    setSelectedBillingCycle(billingCycle);
    setShowPlanSelector(true);
  };

  const handleConfirmPlan = async () => {
    if (!selectedPlan) return;

    setIsUpgrading(true);
    try {
      // Get tenant_id from auth context or API
      const tenantId = 'current'; // This would come from auth context

      await createSubscription({
        tenant_id: tenantId,
        plan_id: selectedPlan.id,
        billing_cycle: selectedBillingCycle,
        start_trial: selectedPlan.trial_days > 0,
      });

      setShowPlanSelector(false);
      setSelectedPlan(null);
    } catch (error) {
      console.error('Failed to create subscription:', error);
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
          <p className="text-muted-foreground">
            Select a plan that fits your business needs
          </p>
        </div>

        <PlanSelector
          plans={plans}
          onSelectPlan={handleSelectPlan}
          loading={isUpgrading}
        />

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
                  'Confirm Subscription'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
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
            subscription={currentSubscription}
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
                  plans={plans}
                  currentPlanId={currentSubscription.plan_id}
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
