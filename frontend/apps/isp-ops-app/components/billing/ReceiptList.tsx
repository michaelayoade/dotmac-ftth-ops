/**
 * Receipt List - ISP Ops App Wrapper
 *
 * Wrapper that connects the shared ReceiptList to app-specific dependencies.
 */

"use client";

import { ReceiptList } from "@dotmac/features/billing";
import type { Receipt as SharedReceipt } from "@dotmac/features/billing";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import type { Receipt } from "@/types/billing";

interface ReceiptListWrapperProps {
  tenantId: string;
  customerId?: string;
  onReceiptSelect?: (receipt: Receipt) => void;
}

export default function ReceiptListWrapper({
  tenantId,
  customerId,
  onReceiptSelect,
}: ReceiptListWrapperProps) {
  // Map shared Receipt callback to app-specific Receipt type
  const handleReceiptSelect = onReceiptSelect
    ? (receipt: SharedReceipt) => {
        // Cast shared Receipt to app Receipt type
        onReceiptSelect(receipt as unknown as Receipt);
      }
    : undefined;

  return (
    <ReceiptList
      tenantId={tenantId}
      customerId={customerId || undefined}
      onReceiptSelect={handleReceiptSelect || undefined}
      apiClient={apiClient}
      logger={logger}
    />
  );
}
