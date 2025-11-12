/**
 * Customer Detail Modal
 *
 * Wrapper that connects the shared CustomerDetailModal to app-specific components and hooks.
 */

import { CustomerDetailModal as SharedCustomerDetailModal } from "@dotmac/features/customers";
import { Customer } from "@/types";
import { useCustomer } from "@/hooks/useCustomers";
import { CustomerActivities } from "./CustomerActivities";
import { CustomerNotes } from "./CustomerNotes";
import { CustomerSubscriptions } from "./CustomerSubscriptions";
import { CustomerNetwork } from "./CustomerNetwork";
import { CustomerDevices } from "./CustomerDevices";
import { CustomerTickets } from "./CustomerTickets";
import { CustomerBilling } from "./CustomerBilling";

interface CustomerDetailModalProps {
  customer: Customer;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}

export function CustomerDetailModal(props: CustomerDetailModalProps) {
  const { getCustomer } = useCustomer();

  return (
    <SharedCustomerDetailModal
      {...props}
      getCustomer={getCustomer}
      CustomerActivities={CustomerActivities}
      CustomerNotes={CustomerNotes}
      CustomerSubscriptions={CustomerSubscriptions}
      CustomerNetwork={CustomerNetwork}
      CustomerDevices={CustomerDevices}
      CustomerTickets={CustomerTickets}
      CustomerBilling={CustomerBilling}
    />
  );
}
