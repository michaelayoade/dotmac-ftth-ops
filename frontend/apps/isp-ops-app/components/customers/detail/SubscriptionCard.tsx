"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Package, DollarSign, Calendar, Zap } from "lucide-react";

interface SubscriptionCardProps {
  subscription: {
    plan?: string;
    bandwidth?: string;
    price?: number;
    cycle?: string;
    status?: string;
  } | null;
  totalSubscriptions: number;
}

export function SubscriptionCard({ subscription, totalSubscriptions }: SubscriptionCardProps) {
  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active subscription</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Current Subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Plan</span>
          <span className="font-medium">{subscription.plan || "Unknown"}</span>
        </div>
        {subscription.bandwidth && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Bandwidth
            </span>
            <span className="font-medium">{subscription.bandwidth}</span>
          </div>
        )}
        {subscription.price !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Price
            </span>
            <span className="font-medium">${subscription.price.toFixed(2)}</span>
          </div>
        )}
        {subscription.cycle && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Billing Cycle
            </span>
            <span className="font-medium capitalize">{subscription.cycle}</span>
          </div>
        )}
        {subscription.status && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={subscription.status === "ACTIVE" ? "default" : "secondary"}>
              {subscription.status}
            </Badge>
          </div>
        )}
        {totalSubscriptions > 1 && (
          <div className="pt-2 border-t text-xs text-muted-foreground">
            +{totalSubscriptions - 1} more subscription(s)
          </div>
        )}
      </CardContent>
    </Card>
  );
}
