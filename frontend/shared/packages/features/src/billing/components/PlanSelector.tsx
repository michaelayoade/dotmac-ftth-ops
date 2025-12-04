/**
 * Plan Selector Component
 *
 * Displays available service plans with pricing and allows selection
 */

"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { cn } from "@dotmac/ui";
import { Check, Sparkles, TrendingUp, Building2, Clock, Percent } from "lucide-react";
import React, { useState } from "react";

import { ServicePlan, BillingCycle, ModuleCategory } from "../types";

interface PlanSelectorProps {
  plans: ServicePlan[];
  currentPlanId?: string;
  onSelectPlan: (plan: ServicePlan, billingCycle: BillingCycle) => void;
  loading?: boolean;
}

const categoryIcons: Record<ModuleCategory, string> = {
  [ModuleCategory.NETWORK]: "🌐",
  [ModuleCategory.OSS_INTEGRATION]: "🔗",
  [ModuleCategory.BILLING]: "💰",
  [ModuleCategory.ANALYTICS]: "📊",
  [ModuleCategory.AUTOMATION]: "🤖",
  [ModuleCategory.COMMUNICATIONS]: "📧",
  [ModuleCategory.SECURITY]: "🔒",
  [ModuleCategory.REPORTING]: "📈",
  [ModuleCategory.API_MANAGEMENT]: "⚙️",
  [ModuleCategory.OTHER]: "📦",
};

export function PlanSelector({
  plans,
  currentPlanId,
  onSelectPlan,
  loading = false,
}: PlanSelectorProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(BillingCycle.MONTHLY);

  const publicPlans = plans.filter((p) => p.is_public && p.is_active);
  const sortedPlans = publicPlans.sort((a, b) => a.base_price_monthly - b.base_price_monthly);

  const calculatePrice = (plan: ServicePlan) => {
    if (billingCycle === BillingCycle.ANNUAL) {
      const annualPrice = plan.base_price_monthly * 12;
      const discount = annualPrice * (plan.annual_discount_percent / 100);
      return {
        price: (annualPrice - discount) / 12,
        originalPrice: plan.base_price_monthly,
        savings: discount / 12,
      };
    }
    return {
      price: plan.base_price_monthly,
      originalPrice: plan.base_price_monthly,
      savings: 0,
    };
  };

  const getPlanIcon = (index: number) => {
    const icons = [
      <Sparkles className="h-6 w-6" key="sparkles" />,
      <TrendingUp className="h-6 w-6" key="trending" />,
      <Building2 className="h-6 w-6" key="building" />,
    ];
    return icons[index] || <Building2 className="h-6 w-6" key="default" />;
  };

  const isRecommended = (plan: ServicePlan, index: number) => {
    // Recommend middle plan
    return index === Math.floor(sortedPlans.length / 2);
  };

  return (
    <div className="space-y-8">
      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center space-x-4">
        <Label htmlFor="billing-cycle" className="text-sm font-medium">
          Monthly
        </Label>
        <Switch
          id="billing-cycle"
          checked={billingCycle === BillingCycle.ANNUAL}
          onCheckedChange={(checked: boolean) =>
            setBillingCycle(checked ? BillingCycle.ANNUAL : BillingCycle.MONTHLY)
          }
        />
        <Label htmlFor="billing-cycle" className="text-sm font-medium flex items-center gap-2">
          Annual
          {sortedPlans.some((p) => p.annual_discount_percent > 0) && (
            <Badge variant="secondary" className="ml-1">
              <Percent className="h-3 w-3 mr-1" />
              Save up to {Math.max(...sortedPlans.map((p) => p.annual_discount_percent))}%
            </Badge>
          )}
        </Label>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedPlans.map((plan, index) => {
          const pricing = calculatePrice(plan);
          const isCurrent = plan.id === currentPlanId;
          const recommended = isRecommended(plan, index);

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative transition-all hover:shadow-lg",
                isCurrent && "border-primary border-2",
                recommended && "border-orange-500 border-2 shadow-lg",
              )}
            >
              {recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">
                    Recommended
                  </Badge>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="">
                    Current Plan
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  {getPlanIcon(index)}
                </div>
                <CardTitle className="text-2xl">{plan.plan_name}</CardTitle>
                <CardDescription className="min-h-[2.5rem]">{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Pricing */}
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">${pricing.price.toFixed(0)}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  {billingCycle === BillingCycle.ANNUAL && pricing.savings > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="line-through">${pricing.originalPrice.toFixed(0)}</span>{" "}
                      <span className="text-green-600 font-medium">
                        Save ${pricing.savings.toFixed(0)}/mo
                      </span>
                    </p>
                  )}
                  {billingCycle === BillingCycle.ANNUAL && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ${(pricing.price * 12).toFixed(0)} billed annually
                    </p>
                  )}
                </div>

                {/* Trial Period */}
                {plan.trial_days > 0 && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{plan.trial_days} day free trial</span>
                  </div>
                )}

                {/* Modules */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Included Features:</p>
                  <ul className="space-y-2">
                    {plan.modules
                      ?.filter((m) => m.included_by_default)
                      .slice(0, 5)
                      .map((planModule) => (
                        <li key={planModule.id} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          <span>
                            {categoryIcons[planModule.module?.category as ModuleCategory]}{" "}
                            {planModule.module?.module_name}
                          </span>
                        </li>
                      ))}
                    {(plan.modules?.filter((m) => m.included_by_default).length || 0) > 5 && (
                      <li className="text-sm text-muted-foreground pl-6">
                        +{(plan.modules?.filter((m) => m.included_by_default).length || 0) - 5} more
                        features
                      </li>
                    )}
                  </ul>
                </div>

                {/* Quotas */}
                {plan.quotas && plan.quotas.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Resource Limits:</p>
                    <ul className="space-y-2">
                      {plan.quotas.slice(0, 3).map((quota) => (
                        <li key={quota.id} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          <span>
                            {quota.included_quantity.toLocaleString()} {quota.quota?.quota_name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : recommended ? "default" : "outline"}
                  onClick={() => onSelectPlan(plan, billingCycle)}
                  disabled={loading || isCurrent}
                >
                  {isCurrent ? "Current Plan" : "Select Plan"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Features Comparison Link */}
      <div className="text-center">
        <Button variant="link" className="text-muted-foreground">
          Compare all features →
        </Button>
      </div>
    </div>
  );
}
