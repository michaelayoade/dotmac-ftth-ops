/**
 * Customer View Modal
 *
 * Wrapper that connects the shared CustomerViewModal to the app's Customer type.
 */

import { CustomerViewModal as SharedCustomerViewModal } from "@dotmac/features/crm";
import { Customer } from "@/types";

interface CustomerViewModalProps {
  customer: Customer;
  onClose: () => void;
}

export function CustomerViewModal(props: CustomerViewModalProps) {
  return <SharedCustomerViewModal {...props} />;
}
