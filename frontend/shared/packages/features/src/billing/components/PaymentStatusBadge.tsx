/**
 * Payment Status Badge
 *
 * Shared component for displaying payment status with consistent styling.
 */

import { Badge } from "@dotmac/ui";

import { PaymentStatus } from "../types";
import { getPaymentStatusColor, getPaymentStatusLabel } from "../utils";

export interface PaymentStatusBadgeProps {
  status: PaymentStatus | string;
  className?: string;
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={`${getPaymentStatusColor(status as PaymentStatus)} ${className || ""}`}
    >
      {getPaymentStatusLabel(status as PaymentStatus)}
    </Badge>
  );
}
