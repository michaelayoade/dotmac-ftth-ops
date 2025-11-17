/**
 * Subscription Dashboard Wrapper
 *
 * Wrapper that connects the shared SubscriptionDashboard to app-specific types.
 */

"use client";

import { SubscriptionDashboard as SharedSubscriptionDashboard } from "@dotmac/features/billing";
import type { TenantSubscription } from "@dotmac/features/billing";

interface SubscriptionDashboardProps {
  subscription: TenantSubscription;
  onUpgrade?: () => void;
  onManageAddons?: () => void;
  onViewUsage?: () => void;
  onManageBilling?: () => void;
}

export function SubscriptionDashboard(props: SubscriptionDashboardProps) {
  return <SharedSubscriptionDashboard {...props} />;
}
