/**
 * Invoice List - ISP Ops App Wrapper
 *
 * Wrapper that connects the shared InvoiceList to app-specific dependencies.
 */

"use client";

import { InvoiceList } from "@dotmac/features/billing";
import type { Invoice as SharedInvoice } from "@dotmac/features/billing";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { useRouter } from "next/navigation";
import { useConfirmDialog } from "@dotmac/ui";
import type { Invoice } from "@/types";

interface InvoiceListWrapperProps {
  tenantId: string;
  onInvoiceSelect?: (invoice: Invoice) => void;
}

export default function InvoiceListWrapper({ tenantId, onInvoiceSelect }: InvoiceListWrapperProps) {
  const router = useRouter();

  // Map shared Invoice callback to app-specific Invoice type
  const handleInvoiceSelect = onInvoiceSelect
    ? (invoice: SharedInvoice) => {
        // Cast shared Invoice to app Invoice type
        onInvoiceSelect(invoice as unknown as Invoice);
      }
    : undefined;

  return (
    <InvoiceList
      tenantId={tenantId}
      onInvoiceSelect={handleInvoiceSelect || undefined}
      apiClient={apiClient}
      logger={logger}
      router={router}
      useConfirmDialog={useConfirmDialog}
    />
  );
}
