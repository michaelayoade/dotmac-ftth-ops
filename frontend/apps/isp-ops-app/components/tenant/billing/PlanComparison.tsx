"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { AvailablePlan } from "@/hooks/useTenantSubscription";
import { Check } from "lucide-react";

interface PlanComparisonProps {
  plans: AvailablePlan[];
  currentPlanId?: string;
  onSelectPlan: (plan: AvailablePlan) => void;
}

export const PlanComparison: React.FC<PlanComparisonProps> = ({
  plans,
  currentPlanId,
  onSelectPlan,
}) => {
  const formatPrice = (amount: number, currency: string, cycle: string) => {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    });
    return `${formatter.format(amount)} / ${cycle}`;
  };

  const getBillingCycleLabel = (cycle: string) => {
    const labels: Record<string, string> = {
      monthly: "month",
      quarterly: "quarter",
      annual: "year",
    };
    return labels[cycle] || cycle;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {plans.map((plan) => {
        const isCurrentPlan = plan.plan_id === currentPlanId;
        const isFeatured = plan.is_featured;

        return (
          <Card
            key={plan.plan_id}
            variant={isFeatured ? "elevated" : "default"}
            className={`relative ${
              isFeatured ? "border-primary shadow-lg scale-105" : ""
            } ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}
          >
            {/* Featured Badge */}
            {isFeatured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-4 py-1">Most Popular</Badge>
              </div>
            )}

            {/* Current Plan Badge */}
            {isCurrentPlan && (
              <div className="absolute top-4 right-4">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  Current Plan
                </Badge>
              </div>
            )}

            <CardHeader className="pb-4">
              <CardTitle className="text-xl">{plan.display_name || plan.name}</CardTitle>
              <CardDescription className="text-sm">{plan.description}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Price Display */}
              <div>
                <div className="text-3xl font-bold">
                  {formatPrice(
                    plan.price_amount,
                    plan.currency,
                    getBillingCycleLabel(plan.billing_cycle),
                  )}
                </div>
                {plan.trial_days > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.trial_days}-day free trial
                  </p>
                )}
              </div>

              {/* Features List */}
              {plan.features && Object.keys(plan.features).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Features:</p>
                  <ul className="space-y-2">
                    {Object.entries(plan.features).map(([key, value]) => {
                      // Handle different feature value types
                      let featureText = key.replace(/_/g, " ");
                      if (typeof value === "boolean" && value) {
                        featureText = featureText;
                      } else if (typeof value === "number") {
                        featureText = `${featureText}: ${value}`;
                      } else if (typeof value === "string") {
                        featureText = `${featureText}: ${value}`;
                      }

                      return (
                        <li key={key} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="capitalize">{featureText}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </CardContent>

            <CardFooter>
              {isCurrentPlan ? (
                <Button variant="outline" disabled className="w-full">
                  Current Plan
                </Button>
              ) : (
                <Button
                  variant={isFeatured ? "default" : "outline"}
                  onClick={() => onSelectPlan(plan)}
                  className="w-full"
                >
                  {currentPlanId ? "Switch to this Plan" : "Select Plan"}
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
};
