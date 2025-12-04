/**
 * Customer Subscriptions - ISP Ops App Wrapper
 *
 * Wrapper that connects the shared CustomerSubscriptions to app-specific dependencies.
 */

"use client";

import { CustomerSubscriptions as CustomerSubscriptionsComponent } from "@dotmac/features/crm";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";

interface CustomerSubscriptionsWrapperProps {
  customerId: string;
}

export function CustomerSubscriptions({ customerId }: CustomerSubscriptionsWrapperProps) {
  return (
    <CustomerSubscriptionsComponent
      customerId={customerId}
      apiClient={apiClient}
      useToast={useToast}
      subscriptionUrlPrefix="/tenant/subscriptions"
    />
  );
}
