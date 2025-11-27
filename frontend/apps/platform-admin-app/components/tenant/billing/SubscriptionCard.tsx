"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { TenantSubscription } from "@/hooks/useTenantSubscription";
import { formatCurrency } from "@dotmac/features/billing";
import { format } from "date-fns";

interface SubscriptionCardProps {
  subscription: TenantSubscription;
  onUpgrade?: () => void;
  onCancel?: () => void;
  onReactivate?: () => void;
}

const statusColors = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  trialing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  past_due: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  canceled: "bg-red-500/10 text-red-500 border-red-500/20",
  unpaid: "bg-red-500/10 text-red-500 border-red-500/20",
};

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  onUpgrade,
  onCancel,
  onReactivate,
}) => {
  const statusColor = statusColors[subscription.status] || statusColors.active;

  const calculateUsagePercentage = (current: number, limit?: number) => {
    if (!limit) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{subscription.plan_name}</CardTitle>
            <CardDescription>
              {formatCurrency(subscription.price_amount, subscription.currency)} /{" "}
              {subscription.billing_cycle}
            </CardDescription>
          </div>
          <Badge className={statusColor}>
            {subscription.status.replace("_", " ").toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Billing Period */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Current Period</p>
          <p className="text-sm">
            {format(new Date(subscription.current_period_start), "MMM d, yyyy")} -{" "}
            {format(new Date(subscription.current_period_end), "MMM d, yyyy")}
          </p>
        </div>

        {/* Trial Period */}
        {subscription.status === "trialing" && subscription.trial_end && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Trial Ends</p>
            <p className="text-sm">{format(new Date(subscription.trial_end), "MMM d, yyyy")}</p>
          </div>
        )}

        {/* Cancellation Notice */}
        {subscription.cancel_at_period_end && (
          <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3">
            <p className="text-sm text-yellow-600 dark:text-yellow-500">
              Your subscription will be canceled on{" "}
              {format(new Date(subscription.current_period_end), "MMM d, yyyy")}
            </p>
          </div>
        )}

        {/* Usage Metrics */}
        {subscription.usage && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Usage</p>

            {subscription.usage.users && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Users</span>
                  <span className="text-muted-foreground">
                    {subscription.usage.users.current}
                    {subscription.usage.users.limit && ` / ${subscription.usage.users.limit}`}
                  </span>
                </div>
                {subscription.usage.users.limit && (
                  <Progress
                    value={calculateUsagePercentage(
                      subscription.usage.users.current,
                      subscription.usage.users.limit,
                    )}
                  />
                )}
              </div>
            )}

            {subscription.usage.storage && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Storage (GB)</span>
                  <span className="text-muted-foreground">
                    {subscription.usage.storage.current}
                    {subscription.usage.storage.limit && ` / ${subscription.usage.storage.limit}`}
                  </span>
                </div>
                {subscription.usage.storage.limit && (
                  <Progress
                    value={calculateUsagePercentage(
                      subscription.usage.storage.current,
                      subscription.usage.storage.limit,
                    )}
                  />
                )}
              </div>
            )}

            {subscription.usage.api_calls && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>API Calls</span>
                  <span className="text-muted-foreground">
                    {subscription.usage.api_calls.current.toLocaleString()}
                    {subscription.usage.api_calls.limit &&
                      ` / ${subscription.usage.api_calls.limit.toLocaleString()}`}
                  </span>
                </div>
                {subscription.usage.api_calls.limit && (
                  <Progress
                    value={calculateUsagePercentage(
                      subscription.usage.api_calls.current,
                      subscription.usage.api_calls.limit,
                    )}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        {subscription.status === "active" && !subscription.cancel_at_period_end && (
          <>
            {onUpgrade && (
              <Button variant="default" onClick={onUpgrade} className="flex-1">
                Upgrade Plan
              </Button>
            )}
            {onCancel && (
              <Button variant="outline" onClick={onCancel} className="flex-1">
                Cancel Subscription
              </Button>
            )}
          </>
        )}

        {subscription.cancel_at_period_end && onReactivate && (
          <Button variant="default" onClick={onReactivate} className="w-full">
            Reactivate Subscription
          </Button>
        )}

        {subscription.status === "past_due" && (
          <Button variant="default" className="w-full">
            Update Payment Method
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
