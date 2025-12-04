/**
 * Invoice Status Badge
 *
 * Shared component for displaying invoice status with consistent styling.
 */

import { Badge } from "@dotmac/ui";

import { InvoiceStatus } from "../types";
import { getInvoiceStatusColor, getInvoiceStatusLabel } from "../utils";

export interface InvoiceStatusBadgeProps {
  status: InvoiceStatus | string;
  className?: string;
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={`${getInvoiceStatusColor(status as InvoiceStatus)} ${className || ""}`}
    >
      {getInvoiceStatusLabel(status as InvoiceStatus)}
    </Badge>
  );
}
