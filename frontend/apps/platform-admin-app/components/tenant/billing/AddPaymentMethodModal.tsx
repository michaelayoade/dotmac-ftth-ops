/**
 * AddPaymentMethodModal Component
 *
 * Wrapper that connects the shared AddPaymentMethodModal to app-specific logger.
 */

"use client";

import { AddPaymentMethodModal as SharedAddPaymentMethodModal } from "@dotmac/features/billing";
import type { AddPaymentMethodRequest, AddPaymentMethodModalProps } from "@dotmac/features/billing";
import { logger } from "@/lib/logger";

export type { AddPaymentMethodRequest };

type WrapperProps = Omit<AddPaymentMethodModalProps, "logger">;

export const AddPaymentMethodModal: React.FC<WrapperProps> = (props) => {
  return <SharedAddPaymentMethodModal {...props} logger={logger} />;
};
