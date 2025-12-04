/**
 * Customers Metrics - ISP Ops App Wrapper
 *
 * Wrapper that connects the shared CustomersMetrics to app-specific types.
 */

"use client";

import { CustomersMetrics as CustomersMetricsComponent } from "@dotmac/features/crm";
import type { CustomerMetrics as SharedCustomerMetrics } from "@dotmac/features/crm";
import type { CustomerMetrics } from "@/types";

interface CustomersMetricsWrapperProps {
  metrics: CustomerMetrics | null;
  loading: boolean;
}

export function CustomersMetrics({ metrics, loading }: CustomersMetricsWrapperProps) {
  // Map app-specific type to shared type
  const sharedMetrics: SharedCustomerMetrics | null =
    metrics as unknown as SharedCustomerMetrics | null;

  return <CustomersMetricsComponent metrics={sharedMetrics} loading={loading} />;
}
