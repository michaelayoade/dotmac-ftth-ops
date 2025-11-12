/**
 * Create Credit Note Modal
 *
 * Wrapper that connects the shared CreateCreditNoteModal to app-specific hooks.
 */

"use client";

import {
  CreateCreditNoteModal as SharedCreateCreditNoteModal,
  type CreateCreditNoteModalProps as SharedCreateCreditNoteModalProps,
  type CreateCreditNoteData,
} from "@dotmac/features/billing";
import { useInvoiceActions } from "@/hooks/useInvoiceActions";

type CreateCreditNoteModalProps = Omit<
  SharedCreateCreditNoteModalProps,
  "onCreateCreditNote" | "isCreating"
>;

export function CreateCreditNoteModal(props: CreateCreditNoteModalProps) {
  const { createCreditNote, isCreatingCreditNote } = useInvoiceActions();

  const handleCreateCreditNote = async (data: CreateCreditNoteData) => {
    await createCreditNote.mutateAsync(data);
  };

  return (
    <SharedCreateCreditNoteModal
      {...props}
      onCreateCreditNote={handleCreateCreditNote}
      isCreating={isCreatingCreditNote}
    />
  );
}
