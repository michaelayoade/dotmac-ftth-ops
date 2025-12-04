/**
 * Customer Notes Component
 *
 * Wrapper that connects the shared CustomerNotes to app-specific hooks.
 */

import {
  CustomerNotes as SharedCustomerNotes,
  type CustomerNote as SharedCustomerNote,
  type CustomerNotesProps as SharedCustomerNotesProps,
} from "@dotmac/features/customers";
import { useCustomerNotes, useAddCustomerNote } from "@/hooks/useCustomersQuery";

interface CustomerNotesProps {
  customerId: string;
}

interface AppCustomerNote {
  id: string;
  customer_id: string;
  subject: string;
  content: string;
  is_internal: boolean;
  created_by_id: string;
  created_at: string;
  updated_at?: string;
}

export function CustomerNotes({ customerId }: CustomerNotesProps) {
  const notesQuery = useCustomerNotes(customerId);
  const addNoteMutation = useAddCustomerNote(customerId);

  const notes = (notesQuery.data || []) as AppCustomerNote[];
  const loading = notesQuery.isLoading || addNoteMutation.isPending;
  const normalizedError = notesQuery.error ? new Error(String(notesQuery.error)) : null;

  const sharedNotes: SharedCustomerNote[] = notes.map((note: AppCustomerNote) => ({
    id: note.id,
    customer_id: note.customer_id,
    note_type: note.is_internal ? "internal" : "general",
    content: note.content,
    is_internal: note.is_internal,
    tags: [],
    metadata: {},
    created_at: note.created_at,
    created_by: note.created_by_id ?? "system",
    created_by_name: note.created_by_id,
    updated_at: note.updated_at ?? note.created_at,
  }));

  const handleAddNote: SharedCustomerNotesProps["addNote"] = async (note) => {
    await addNoteMutation.mutateAsync(note.content);
  };

  return (
    <SharedCustomerNotes
      customerId={customerId}
      notes={sharedNotes}
      loading={loading}
      error={normalizedError}
      addNote={handleAddNote}
    />
  );
}
