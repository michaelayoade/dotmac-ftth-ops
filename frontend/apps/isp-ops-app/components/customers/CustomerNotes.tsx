/**
 * Customer Notes Component
 *
 * Wrapper that connects the shared CustomerNotes to app-specific hooks.
 */

import { CustomerNotes as SharedCustomerNotes } from "@dotmac/features/customers";
import { useCustomerNotes, CustomerNote } from "@/hooks/useCustomers";

interface CustomerNotesProps {
  customerId: string;
}

export function CustomerNotes({ customerId }: CustomerNotesProps) {
  const { notes, loading, error, addNote } = useCustomerNotes(customerId);
  const normalizedError = error ? new Error(error) : null;

  return (
    <SharedCustomerNotes
      customerId={customerId}
      notes={notes as any}
      loading={loading}
      error={normalizedError}
      addNote={addNote as any}
    />
  );
}
