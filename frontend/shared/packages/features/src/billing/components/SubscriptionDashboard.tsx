/**
 * Subscription Dashboard Component
 *
 * Displays current subscription status, usage, and management options
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
import { format } from "date-fns";
import { Calendar, CreditCard, TrendingUp, AlertTriangle, Check, Plus, X } from "lucide-react";
import React from "react";

import { TenantSubscription, SubscriptionStatus } from "../types";

interface SubscriptionDashboardProps {
  subscription: TenantSubscription;
  onUpgrade?: () => void;
  onManageAddons?: () => void;
  onViewUsage?: () => void;
  onManageBilling?: () => void;
}

const statusConfig: Record<
  SubscriptionStatus,
  { color: string; icon: React.ReactNode; label: string }
> = {
  [SubscriptionStatus.TRIAL]: {
    color: "bg-blue-500",
    icon: <Clock className="h-4 w-4" />,
    label: "Free Trial",
  },
  [SubscriptionStatus.ACTIVE]: {
    color: "bg-green-500",
    icon: <Check className="h-4 w-4" />,
    label: "Active",
  },
  [SubscriptionStatus.PAST_DUE]: {
    color: "bg-orange-500",
    icon: <AlertTriangle className="h-4 w-4" />,
    label: "Past Due",
  },
  [SubscriptionStatus.CANCELED]: {
    color: "bg-gray-500",
    icon: <X className="h-4 w-4" />,
    label: "Canceled",
  },
  [SubscriptionStatus.EXPIRED]: {
    color: "bg-red-500",
    icon: <X className="h-4 w-4" />,
    label: "Expired",
  },
  [SubscriptionStatus.SUSPENDED]: {
    color: "bg-yellow-500",
    icon: <AlertTriangle className="h-4 w-4" />,
    label: "Suspended",
  },
};

function Clock({ className }: { className?: string }) {
  return <Calendar className={className} />;
}

export function SubscriptionDashboard({
  subscription,
  onUpgrade,
  onManageAddons,
  onViewUsage,
  onManageBilling,
}: SubscriptionDashboardProps) {
  const statusInfo = statusConfig[subscription.status];
  const isTrialing = subscription.status === SubscriptionStatus.TRIAL;
  const daysUntilRenewal = subscription.current_period_end
    ? Math.ceil(
        (new Date(subscription.current_period_end).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  const trialDaysRemaining = subscription.trial_end
    ? Math.ceil(
        (new Date(subscription.trial_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      )
    : 0;

  // Calculate total price
  const basePrice = subscription.monthly_price;
  const addonsPriceTotal =
    subscription.modules
      ?.filter((m) => m.source === "ADDON" && m.addon_price)
      .reduce((sum, m) => sum + (m.addon_price || 0), 0) || 0;
  const totalPrice = basePrice + addonsPriceTotal;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">
                  {subscription.plan?.plan_name || "Current Plan"}
                </CardTitle>
                <Badge variant="default" className={statusInfo.color}>
                  {statusInfo.icon}
                  <span className="ml-1">{statusInfo.label}</span>
                </Badge>
              </div>
              <CardDescription>{subscription.plan?.description}</CardDescription>
            </div>
            {onUpgrade && (
              <Button onClick={onUpgrade} size="sm">
                <TrendingUp className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Trial Warning */}
          {isTrialing && trialDaysRemaining > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900">
                    {trialDaysRemaining} days remaining in your trial
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Your trial ends on {format(new Date(subscription.trial_end!), "PPP")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pricing */}
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-3xl font-bold">${totalPrice.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">
                per month • {subscription.billing_cycle}
              </p>
            </div>
            {onManageBilling && (
              <Button variant="outline" size="sm" onClick={onManageBilling}>
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Billing
              </Button>
            )}
          </div>

          <Separator />

          {/* Next Billing Date */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Next billing date</span>
            <span className="font-medium">
              {format(new Date(subscription.current_period_end), "PPP")}
              <span className="text-muted-foreground ml-2">({daysUntilRenewal} days)</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Included Features */}
      <Card>
        <CardHeader>
          <CardTitle>Included Features</CardTitle>
          <CardDescription>Modules and capabilities included in your plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subscription.modules?.map((module) => (
              <div key={module.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{module.module?.module_name}</p>
                  <p className="text-sm text-muted-foreground">{module.module?.description}</p>
                  {module.source === "ADDON" && (
                    <Badge variant="secondary" className="mt-1">
                      Add-on • ${module.addon_price}/mo
                    </Badge>
                  )}
                  {module.source === "TRIAL" && (
                    <Badge variant="outline" className="mt-1">
                      Trial Only
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {onManageAddons && (
            <Button variant="outline" className="w-full mt-4" onClick={onManageAddons}>
              <Plus className="mr-2 h-4 w-4" />
              Add More Features
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Resource Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Resource Usage</CardTitle>
              <CardDescription>Current usage of your allocated resources</CardDescription>
            </div>
            {onViewUsage && (
              <Button variant="outline" size="sm" onClick={onViewUsage}>
                View Details
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {subscription.quota_usage?.map((usage) => {
            const percentage = (usage.current_usage / usage.allocated_quantity) * 100;
            const isNearLimit = percentage >= 80;
            const isOverLimit = usage.overage_quantity > 0;

            return (
              <div key={usage.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{usage.quota?.quota_name}</span>
                  <span className={isOverLimit ? "text-red-600 font-medium" : ""}>
                    {usage.current_usage.toLocaleString()} /{" "}
                    {usage.allocated_quantity.toLocaleString()} {usage.quota?.unit_name}
                    {isOverLimit && ` (+${usage.overage_quantity} overage)`}
                  </span>
                </div>
                <Progress
                  value={Math.min(percentage, 100)}
                  className={isOverLimit ? "bg-red-100" : isNearLimit ? "bg-orange-100" : ""}
                />
                {isOverLimit && usage.overage_charges > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Overage charges: ${usage.overage_charges.toFixed(2)}
                  </p>
                )}
                {isNearLimit && !isOverLimit && (
                  <p className="text-xs text-orange-600">
                    <AlertTriangle className="inline h-3 w-3 mr-1" />
                    Approaching limit
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
