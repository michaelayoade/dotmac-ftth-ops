/**
 * Customer Billing - ISP Ops App Wrapper
 *
 * Wrapper that connects the shared CustomerBilling to app-specific dependencies.
 */

"use client";

import { CustomerBilling as CustomerBillingComponent } from "@dotmac/features/billing";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";

interface CustomerBillingWrapperProps {
  customerId: string;
}

export function CustomerBilling({ customerId }: CustomerBillingWrapperProps) {
  return (
    <CustomerBillingComponent
      customerId={customerId}
      apiClient={apiClient}
      useToast={useToast}
      invoiceViewUrlPrefix="/tenant/billing/invoices"
    />
  );
}
