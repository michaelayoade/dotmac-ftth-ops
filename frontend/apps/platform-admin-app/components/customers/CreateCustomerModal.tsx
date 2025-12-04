/**
 * Create Customer Modal
 *
 * Wrapper that connects the shared CreateCustomerModal to app-specific types and logging.
 */

import { CreateCustomerModal as SharedCreateCustomerModal } from "@dotmac/features/customers";
import { Customer, CustomerCreateInput, CustomerUpdateInput } from "@/types";
import { logger } from "@/lib/logger";

interface CreateCustomerModalProps {
  onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
  editingCustomer?: Customer | null;
  createCustomer: (payload: CustomerCreateInput) => Promise<Customer>;
  updateCustomer: (id: string, payload: CustomerUpdateInput) => Promise<Customer>;
  loading?: boolean;
}

export function CreateCustomerModal(props: CreateCustomerModalProps) {
  const handleCustomerCreated = (customer: Customer) => {
    logger.info("Customer saved successfully", { customerId: customer.id });
    props.onCustomerCreated(customer);
  };

  return <SharedCreateCustomerModal {...props} onCustomerCreated={handleCustomerCreated} />;
}
