/**
 * Payment Processor Integration Hook
 * Provides unified interface for multiple payment processors
 * Split into focused sub-hooks for better maintainability
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useISPTenant } from "./useISPTenant";
import { getISPApiClient } from "../api/isp-client";
import { usePaymentCache } from "./payment/usePaymentCache";
import { usePaymentValidation } from "./payment/usePaymentValidation";
import { usePaymentSecurity } from "./payment/usePaymentSecurity";
import { useStandardErrorHandler } from "./useStandardErrorHandler";
import type {
  PaymentProcessor,
  PaymentMethod,
  PaymentIntent,
  Transaction,
  BillingAnalytics,
  WebhookEvent,
} from "../types/billing";

export interface UsePaymentProcessorConfig {
  autoLoadProcessors?: boolean;
  enableWebhooks?: boolean;
  retryFailedPayments?: boolean;
  cacheDuration?: number;
}

export interface UsePaymentProcessorReturn {
  // State
  processors: PaymentProcessor[];
  selectedProcessor: PaymentProcessor | null;
  paymentMethods: PaymentMethod[];
  recentTransactions: Transaction[];
  analytics: BillingAnalytics | null;
  webhookEvents: WebhookEvent[];
  isLoading: boolean;
  error: string | null;

  // Core Operations (focused interface)
  loadProcessors: () => Promise<void>;
  selectProcessor: (processorId: string) => void;
  loadPaymentMethods: (customerId: string) => Promise<void>;
  createPaymentIntent: (
    amount: number,
    currency: string,
    customerId: string,
  ) => Promise<PaymentIntent>;
  loadTransactions: (filters?: any) => Promise<void>;
  formatAmount: (amount: number, currency: string) => string;
}

export function usePaymentProcessor(
  config: UsePaymentProcessorConfig = {},
): UsePaymentProcessorReturn {
  const { tenant, hasPermission } = useISPTenant();
  const { autoLoadProcessors = true } = config;

  // Sub-hooks for focused functionality
  const cache = usePaymentCache();
  const validation = usePaymentValidation();
  const security = usePaymentSecurity();
  const ispClient = useMemo(() => getISPApiClient(), []);

  // Core state
  const [processors, setProcessors] = useState<PaymentProcessor[]>([]);
  const [selectedProcessor, setSelectedProcessor] = useState<PaymentProcessor | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [analytics, setAnalytics] = useState<BillingAnalytics | null>(null);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core operations with standardized error handling
  const errorHandler = useStandardErrorHandler({
    context: "Payment Processor",
    enableRetry: true,
    maxRetries: 2,
    fallbackData: [],
    onFallback: (fallbackData) => {
      setProcessors(fallbackData);
    },
  });

  const loadProcessors = useCallback(async () => {
    if (!tenant || !hasPermission("billing.payments.read")) return;

    setIsLoading(true);
    setError(null);

    const result = await errorHandler.withErrorHandling(async () => {
      const cachedData = cache.getCachedData("processors");
      if (cachedData) {
        return cachedData;
      }

      const response = await ispClient.getBillingProcessors({
        tenant_id: tenant.id,
      });

      cache.setCachedData("processors", response.data);
      return response.data;
    });

    if (result) {
      setProcessors(result);
      const activeProcessor = result.find((p) => p.status === "ACTIVE");
      if (activeProcessor) {
        setSelectedProcessor(activeProcessor);
      }
    } else if (errorHandler.error) {
      setError(errorHandler.error.userMessage);
    }

    setIsLoading(false);
  }, [tenant, hasPermission, cache, errorHandler, ispClient]);

  const selectProcessor = useCallback(
    (processorId: string) => {
      const processor = processors.find((p) => p.id === processorId);
      if (processor && security.validateProcessorAccess(processorId)) {
        setSelectedProcessor(processor);
        setPaymentMethods([]);
      }
    },
    [processors, security],
  );

  const loadPaymentMethods = useCallback(
    async (customerId: string) => {
      if (!selectedProcessor || !hasPermission("billing.payments.read")) return;

      const customerValidation = validation.validateCustomerId(customerId);
      if (!customerValidation.isValid) {
        setError(customerValidation.errors.join(", "));
        return;
      }

      setIsLoading(true);
      try {
        const cacheKey = `payment-methods-${customerId}`;
        const cachedData = cache.getCachedData(cacheKey);
        if (cachedData) {
          setPaymentMethods(cachedData);
          setIsLoading(false);
          return;
        }

        const response = await ispClient.getCustomerPaymentMethods(customerId, {
          processor_id: selectedProcessor.id,
          tenant_id: tenant?.id,
        });

        setPaymentMethods(response.data);
        cache.setCachedData(cacheKey, response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load payment methods");
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProcessor, hasPermission, tenant, validation, cache, ispClient],
  );

  const createPaymentIntent = useCallback(
    async (amount: number, currency: string, customerId: string): Promise<PaymentIntent> => {
      if (!selectedProcessor || !hasPermission("billing.payments.process")) {
        throw new Error("Insufficient permissions");
      }

      const paymentValidation = validation.validatePaymentData({
        amount,
        currency,
        customer_id: customerId,
      });
      if (!paymentValidation.isValid) {
        throw new Error(paymentValidation.errors.join(", "));
      }

      const response = await ispClient.createPaymentIntent({
        amount,
        currency,
        customer_id: customerId,
        processor_id: selectedProcessor.id,
        tenant_id: tenant?.id,
      });

      return response.data;
    },
    [selectedProcessor, hasPermission, tenant, validation, ispClient],
  );

  const loadTransactions = useCallback(
    async (filters: any = {}) => {
      if (!hasPermission("billing.payments.read")) return;

      setIsLoading(true);
      try {
        const response = await ispClient.getTransactions({
          ...filters,
          tenant_id: tenant?.id,
          limit: filters.limit || 50,
        });

        setRecentTransactions(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load transactions");
      } finally {
        setIsLoading(false);
      }
    },
    [hasPermission, tenant, ispClient],
  );

  const formatAmount = useCallback((amount: number, currency: string): string => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
        minimumFractionDigits: 2,
      }).format(amount / 100); // Assuming amounts are in cents
    } catch (err) {
      return `${amount / 100} ${currency.toUpperCase()}`;
    }
  }, []);

  // Initial load effect
  useEffect(() => {
    if (autoLoadProcessors && tenant) {
      loadProcessors();
    }
  }, [autoLoadProcessors, tenant, loadProcessors]);

  return {
    // State
    processors,
    selectedProcessor,
    paymentMethods,
    recentTransactions,
    analytics,
    webhookEvents,
    isLoading,
    error,

    // Core Operations
    loadProcessors,
    selectProcessor,
    loadPaymentMethods,
    createPaymentIntent,
    loadTransactions,
    formatAmount,
  };
}
