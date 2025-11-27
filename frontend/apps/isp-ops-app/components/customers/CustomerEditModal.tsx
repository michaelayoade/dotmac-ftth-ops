/**
 * Customer Edit Modal
 *
 * Wrapper that connects the shared CustomerEditModal to app-specific types and logging.
 */

"use client";

import { CustomerEditModal as SharedCustomerEditModal } from "@dotmac/features/customers";
import { Customer } from "@/types";
import { logger } from "@/lib/logger";

interface CustomerEditModalProps {
  customer?: Customer | null;
  onClose: () => void;
  onCustomerUpdated: (customer: Customer) => void;
  updateCustomer?: (id: string, data: any) => Promise<Customer>;
  loading?: boolean;
}

export function CustomerEditModal(props: CustomerEditModalProps) {
  const handleCustomerUpdated = (customer: Customer) => {
    logger.info("Customer updated successfully", { customerId: customer.id });
    props.onCustomerUpdated(customer);
  };

  return <SharedCustomerEditModal {...props} onCustomerUpdated={handleCustomerUpdated} />;
}
