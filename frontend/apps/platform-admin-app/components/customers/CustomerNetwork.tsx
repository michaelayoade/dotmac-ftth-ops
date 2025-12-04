/**
 * Customer Network
 *
 * Wrapper that connects the shared CustomerNetwork to app-specific API client.
 */

import { CustomerNetwork as SharedCustomerNetwork } from "@dotmac/features/customers";
import { apiClient } from "@/lib/api/client";

interface CustomerNetworkProps {
  customerId: string;
}

export function CustomerNetwork({ customerId }: CustomerNetworkProps) {
  return <SharedCustomerNetwork customerId={customerId} apiClient={apiClient} />;
}
