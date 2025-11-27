/**
 * Customers List
 *
 * Wrapper that connects the shared CustomersList to app-specific types and configuration.
 */

"use client";

import { CustomersList as SharedCustomersList } from "@dotmac/features/customers";
import type { Customer } from "@dotmac/graphql/generated";
import { platformConfig } from "@/lib/config";
import { logger } from "@/lib/logger";
import { impersonateCustomer as impersonateCustomerUtil } from "../../../../shared/utils/customerImpersonation";

interface CustomersListProps {
  customers: Customer[];
  loading: boolean;
  onCustomerSelect: (customer: Customer) => void;
  onEditCustomer?: (customer: Customer) => void;
  onDeleteCustomer?: (customer: Customer) => void;
}

const buildAuthHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
});

export function CustomersList(props: CustomersListProps) {
  const apiBaseUrl = platformConfig.api.baseUrl || "";

  const handleImpersonateCustomer = async (customerId: string) => {
    logger.info("Impersonating customer", { customerId });

    await impersonateCustomerUtil({
      customerId,
      baseUrl: apiBaseUrl,
      buildHeaders: buildAuthHeaders,
    });
  };

  const handleUpdateCustomerStatus = async (customerId: string, status: string) => {
    logger.info("Updating customer status", { customerId, status });

    const response = await fetch(`${apiBaseUrl}/api/v1/customers/${customerId}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ status }),
    });

    if (!response.ok) throw new Error("Failed to update customer status");
  };

  const handleResetCustomerPassword = async (customerId: string) => {
    logger.info("Resetting customer password", { customerId });

    const response = await fetch(`${apiBaseUrl}/api/v1/customers/${customerId}/reset-password`, {
      method: "POST",
      credentials: "include",
      headers: buildAuthHeaders(),
    });

    if (!response.ok) throw new Error("Failed to send reset password email");
  };

  return (
    <SharedCustomersList
      {...props}
      apiBaseUrl={apiBaseUrl}
      buildAuthHeaders={buildAuthHeaders}
      impersonateCustomer={handleImpersonateCustomer}
      updateCustomerStatus={handleUpdateCustomerStatus}
      resetCustomerPassword={handleResetCustomerPassword}
      portalPath="/customer-portal"
    />
  );
}
