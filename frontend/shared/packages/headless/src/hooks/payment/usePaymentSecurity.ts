/**
 * Payment Security Hook
 * Handles security-related operations for payments
 */

import { useCallback } from "react";
import { useISPTenant } from "../useISPTenant";
import { ispApiClient } from "../../api/isp-client";

export interface UsePaymentSecurityReturn {
  tokenizeCard: (cardData: any, processorId: string) => Promise<string>;
  encryptSensitiveData: (data: any) => Promise<string>;
  validateProcessorAccess: (processorId: string) => boolean;
  sanitizePaymentData: (data: any) => any;
}

export function usePaymentSecurity(): UsePaymentSecurityReturn {
  const { tenant, hasPermission } = useISPTenant();

  const tokenizeCard = useCallback(
    async (cardData: any, processorId: string): Promise<string> => {
      if (!processorId) {
        throw new Error("Processor ID is required for tokenization");
      }

      if (!hasPermission("billing.payments.process")) {
        throw new Error("Insufficient permissions for tokenization");
      }

      try {
        const client = ispApiClient.get().billing;
        const response = await client.tokenizePaymentMethod({
          processor_id: processorId,
          payment_method_data: cardData,
          tenant_id: tenant?.id,
        });

        return response.data.token;
      } catch (error) {
        throw new Error(
          "Tokenization failed: " + (error instanceof Error ? error.message : "Unknown error"),
        );
      }
    },
    [hasPermission, tenant],
  );

  const encryptSensitiveData = useCallback(
    async (data: any): Promise<string> => {
      if (!data) {
        throw new Error("Data is required for encryption");
      }

      if (!hasPermission("billing.payments.process")) {
        throw new Error("Insufficient permissions for encryption");
      }

      try {
        const client = ispApiClient.get().billing;
        const response = await client.encryptBillingData({
          data,
          tenant_id: tenant?.id,
        });

        return response.data.encrypted_data;
      } catch (error) {
        throw new Error(
          "Encryption failed: " + (error instanceof Error ? error.message : "Unknown error"),
        );
      }
    },
    [hasPermission, tenant],
  );

  const validateProcessorAccess = useCallback(
    (processorId: string): boolean => {
      if (!processorId || !tenant) return false;
      return hasPermission("billing.payments.read");
    },
    [hasPermission, tenant],
  );

  const sanitizePaymentData = useCallback((data: any): any => {
    if (!data || typeof data !== "object") return data;

    const sanitized = { ...data };

    // Remove sensitive fields that should never be logged or cached
    const sensitiveFields = [
      "card_number",
      "number",
      "cvv",
      "cvc",
      "cvv2",
      "secret_key",
      "private_key",
      "api_key",
      "password",
      "ssn",
      "tax_id",
      "account_number",
    ];

    sensitiveFields.forEach((field) => {
      if (field in sanitized) {
        delete sanitized[field];
      }
    });

    // Mask partial card numbers if present
    if (sanitized.card_last4 && sanitized.card_last4.length > 4) {
      sanitized.card_last4 = sanitized.card_last4.slice(-4);
    }

    return sanitized;
  }, []);

  return {
    tokenizeCard,
    encryptSensitiveData,
    validateProcessorAccess,
    sanitizePaymentData,
  };
}
