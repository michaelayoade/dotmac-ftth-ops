/**
 * Plan Selector Wrapper
 *
 * Wrapper that connects the shared PlanSelector to app-specific types.
 */

"use client";

import { PlanSelector as SharedPlanSelector } from "@dotmac/features/billing";
import type { ServicePlan, BillingCycle } from "@dotmac/features/billing";

interface PlanSelectorProps {
  plans: ServicePlan[];
  currentPlanId?: string;
  onSelectPlan: (plan: ServicePlan, billingCycle: BillingCycle) => void;
  loading?: boolean;
}

export function PlanSelector(props: PlanSelectorProps) {
  return <SharedPlanSelector {...props} />;
}
