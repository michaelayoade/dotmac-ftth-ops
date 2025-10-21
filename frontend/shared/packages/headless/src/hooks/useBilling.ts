import { useState, useEffect, useCallback, useRef } from "react";
import { useNotifications } from "./useNotifications";

export interface BillingAccount {
  id: string;
  customerId: string;
  accountNumber: string;
  billingCycle: "monthly" | "quarterly" | "annually";
  status: "active" | "suspended" | "cancelled" | "past_due";
  balance: number;
  nextBillDate: Date;
  lastPaymentDate?: Date;
  paymentMethod?: PaymentMethod;
  billingAddress: Address;
  preferences: BillingPreferences;
  metadata?: Record<string, any>;
}

export interface PaymentMethod {
  id: string;
  type: "credit_card" | "bank_account" | "paypal" | "ach" | "wire";
  isDefault: boolean;
  lastFour: string;
  expiryDate?: string;
  brand?: string;
  status: "active" | "expired" | "declined";
  billingAddress?: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface BillingPreferences {
  paperlessBilling: boolean;
  autoPayEnabled: boolean;
  reminderDays: number[];
  currency: string;
  language: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  accountId: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled" | "refunded";
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  lineItems: InvoiceLineItem[];
  payments: Payment[];
  notes?: string;
  metadata?: Record<string, any>;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  serviceId?: string;
  servicePeriod?: {
    start: Date;
    end: Date;
  };
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled" | "refunded";
  method: PaymentMethod;
  gateway: "stripe" | "paypal" | "square" | "authorize_net" | "manual";
  transactionId?: string;
  gatewayTransactionId?: string;
  processedAt?: Date;
  failureReason?: string;
  refundedAmount?: number;
  metadata?: Record<string, any>;
}

export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  pricing: {
    setup?: number;
    monthly?: number;
    quarterly?: number;
    annually?: number;
  };
  features: string[];
  limits?: Record<string, number>;
  trialDays?: number;
  isActive: boolean;
  category: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  status: "active" | "cancelled" | "past_due" | "unpaid" | "trialing";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelledAt?: Date;
  cancelAtPeriodEnd: boolean;
  quantity: number;
  unitAmount: number;
  metadata?: Record<string, any>;
}

export interface BillingStats {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  averageRevenuePerUser: number;
  churnRate: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalOutstanding: number;
  collectionRate: number;
  paymentMethodBreakdown: Record<string, number>;
  revenueByPlan: Record<string, number>;
  recentPayments: Payment[];
  upcomingRenewals: Subscription[];
}

interface UseBillingOptions {
  apiEndpoint?: string;
  websocketEndpoint?: string;
  apiKey?: string;
  tenantId?: string;
  resellerId?: string;
  stripePk?: string;
  paypalClientId?: string;
  pollInterval?: number;
  enableRealtime?: boolean;
  maxRetries?: number;
}

interface BillingState {
  accounts: BillingAccount[];
  invoices: Invoice[];
  payments: Payment[];
  plans: BillingPlan[];
  subscriptions: Subscription[];
  stats: BillingStats | null;
  selectedAccount: BillingAccount | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  paymentProcessing: boolean;
}

const initialStats: BillingStats = {
  totalRevenue: 0,
  monthlyRecurringRevenue: 0,
  averageRevenuePerUser: 0,
  churnRate: 0,
  totalInvoices: 0,
  paidInvoices: 0,
  overdueInvoices: 0,
  totalOutstanding: 0,
  collectionRate: 0,
  paymentMethodBreakdown: {},
  revenueByPlan: {},
  recentPayments: [],
  upcomingRenewals: [],
};

const initialState: BillingState = {
  accounts: [],
  invoices: [],
  payments: [],
  plans: [],
  subscriptions: [],
  stats: initialStats,
  selectedAccount: null,
  isLoading: false,
  error: null,
  isConnected: false,
  paymentProcessing: false,
};

export function useBilling(options: UseBillingOptions = {}) {
  const {
    apiEndpoint = "/api/billing",
    websocketEndpoint,
    apiKey,
    tenantId,
    resellerId,
    stripePk,
    paypalClientId,
    pollInterval = 60000,
    enableRealtime = true,
    maxRetries = 3,
  } = options;

  const [state, setState] = useState<BillingState>(initialState);
  const websocketRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const { addNotification } = useNotifications();

  // API Helper
  const apiCall = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
      };

      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      if (tenantId) {
        headers["X-Tenant-ID"] = tenantId;
      }

      if (resellerId) {
        headers["X-Reseller-ID"] = resellerId;
      }

      const response = await fetch(`${apiEndpoint}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    [apiEndpoint, apiKey, tenantId, resellerId],
  );

  // WebSocket Connection
  const connectWebSocket = useCallback(() => {
    if (!websocketEndpoint || !enableRealtime) return;

    try {
      if (websocketRef.current?.readyState === WebSocket.OPEN) return;

      const wsUrl = new URL(websocketEndpoint);
      if (apiKey) wsUrl.searchParams.set("apiKey", apiKey);
      if (tenantId) wsUrl.searchParams.set("tenantId", tenantId);
      if (resellerId) wsUrl.searchParams.set("resellerId", resellerId);

      const ws = new WebSocket(wsUrl.toString());
      websocketRef.current = ws;

      ws.onopen = () => {
        setState((prev) => ({ ...prev, isConnected: true, error: null }));
        retryCountRef.current = 0;

        addNotification({
          type: "system",
          priority: "low",
          title: "Billing System",
          message: "Real-time billing updates connected",
          channel: ["browser"],
          persistent: false,
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "payment_completed":
              setState((prev) => ({
                ...prev,
                payments: [data.payment, ...prev.payments],
                invoices: prev.invoices.map((inv) =>
                  inv.id === data.payment.invoiceId
                    ? {
                        ...inv,
                        status: "paid",
                        paidDate: new Date(data.payment.processedAt),
                      }
                    : inv,
                ),
              }));

              addNotification({
                type: "success",
                priority: "medium",
                title: "Payment Received",
                message: `Payment of $${data.payment.amount} completed successfully`,
                channel: ["browser"],
                persistent: false,
              });
              break;

            case "payment_failed":
              setState((prev) => ({
                ...prev,
                payments: prev.payments.map((payment) =>
                  payment.id === data.paymentId
                    ? {
                        ...payment,
                        status: "failed",
                        failureReason: data.reason,
                      }
                    : payment,
                ),
              }));

              addNotification({
                type: "error",
                priority: "high",
                title: "Payment Failed",
                message: `Payment failed: ${data.reason}`,
                channel: ["browser"],
                persistent: true,
              });
              break;

            case "invoice_created":
              setState((prev) => ({
                ...prev,
                invoices: [data.invoice, ...prev.invoices],
              }));

              addNotification({
                type: "info",
                priority: "medium",
                title: "New Invoice",
                message: `Invoice ${data.invoice.invoiceNumber} created`,
                channel: ["browser"],
                persistent: false,
              });
              break;

            case "invoice_overdue":
              setState((prev) => ({
                ...prev,
                invoices: prev.invoices.map((inv) =>
                  inv.id === data.invoiceId ? { ...inv, status: "overdue" } : inv,
                ),
              }));

              addNotification({
                type: "warning",
                priority: "high",
                title: "Invoice Overdue",
                message: `Invoice ${data.invoiceNumber} is now overdue`,
                channel: ["browser"],
                persistent: true,
              });
              break;

            case "subscription_renewed":
              setState((prev) => ({
                ...prev,
                subscriptions: prev.subscriptions.map((sub) =>
                  sub.id === data.subscriptionId ? { ...sub, ...data.updates } : sub,
                ),
              }));
              break;

            case "stats_update":
              setState((prev) => ({
                ...prev,
                stats: data.stats,
              }));
              break;
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        setState((prev) => ({ ...prev, isConnected: false }));

        // Reconnect with exponential backoff
        if (retryCountRef.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
          setTimeout(() => {
            retryCountRef.current++;
            connectWebSocket();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: "WebSocket connection failed",
        }));
      };
    } catch (error) {
      console.error("Failed to establish WebSocket connection:", error);
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: error instanceof Error ? error.message : "Connection failed",
      }));
    }
  }, [
    websocketEndpoint,
    enableRealtime,
    apiKey,
    tenantId,
    resellerId,
    maxRetries,
    addNotification,
  ]);

  // Load Billing Accounts
  const loadAccounts = useCallback(
    async (
      filters: {
        status?: string;
        customerId?: string;
        limit?: number;
      } = {},
    ) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, String(value));
          }
        });

        const data = await apiCall(`/accounts?${params.toString()}`);
        setState((prev) => ({
          ...prev,
          accounts: data.accounts || [],
          isLoading: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to load accounts",
          isLoading: false,
        }));
      }
    },
    [apiCall],
  );

  // Load Invoices
  const loadInvoices = useCallback(
    async (
      filters: {
        status?: string;
        customerId?: string;
        accountId?: string;
        dateFrom?: Date;
        dateTo?: Date;
        limit?: number;
      } = {},
    ) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));

        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, value instanceof Date ? value.toISOString() : String(value));
          }
        });

        const data = await apiCall(`/invoices?${params.toString()}`);
        setState((prev) => ({
          ...prev,
          invoices: data.invoices || [],
          isLoading: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to load invoices",
          isLoading: false,
        }));
      }
    },
    [apiCall],
  );

  // Load Payments
  const loadPayments = useCallback(
    async (
      filters: {
        status?: string;
        customerId?: string;
        invoiceId?: string;
        dateFrom?: Date;
        dateTo?: Date;
        limit?: number;
      } = {},
    ) => {
      try {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, value instanceof Date ? value.toISOString() : String(value));
          }
        });

        const data = await apiCall(`/payments?${params.toString()}`);
        setState((prev) => ({
          ...prev,
          payments: data.payments || [],
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to load payments",
        }));
      }
    },
    [apiCall],
  );

  // Load Statistics
  const loadStats = useCallback(
    async (timeRange: "30d" | "90d" | "1y" = "30d") => {
      try {
        const data = await apiCall(`/stats?range=${timeRange}`);
        setState((prev) => ({
          ...prev,
          stats: data.stats || initialStats,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to load statistics",
        }));
      }
    },
    [apiCall],
  );

  // Process Payment
  const processPayment = useCallback(
    async (paymentData: {
      invoiceId: string;
      amount: number;
      paymentMethodId: string;
      gateway?: string;
      metadata?: Record<string, any>;
    }) => {
      try {
        setState((prev) => ({ ...prev, paymentProcessing: true }));

        const data = await apiCall("/payments", {
          method: "POST",
          body: JSON.stringify(paymentData),
        });

        const newPayment = data.payment;
        setState((prev) => ({
          ...prev,
          payments: [newPayment, ...prev.payments],
          paymentProcessing: false,
        }));

        if (newPayment.status === "completed") {
          addNotification({
            type: "success",
            priority: "medium",
            title: "Payment Processed",
            message: `Payment of $${newPayment.amount} processed successfully`,
            channel: ["browser"],
            persistent: false,
          });
        } else if (newPayment.status === "failed") {
          addNotification({
            type: "error",
            priority: "high",
            title: "Payment Failed",
            message: newPayment.failureReason || "Payment processing failed",
            channel: ["browser"],
            persistent: true,
          });
        }

        return newPayment;
      } catch (error) {
        setState((prev) => ({ ...prev, paymentProcessing: false }));

        const errorMessage = error instanceof Error ? error.message : "Payment processing failed";

        addNotification({
          type: "error",
          priority: "high",
          title: "Payment Error",
          message: errorMessage,
          channel: ["browser"],
          persistent: true,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Create Invoice
  const createInvoice = useCallback(
    async (invoiceData: {
      customerId: string;
      accountId?: string;
      dueDate: Date;
      lineItems: Omit<InvoiceLineItem, "id">[];
      notes?: string;
      sendEmail?: boolean;
    }) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));

        const data = await apiCall("/invoices", {
          method: "POST",
          body: JSON.stringify({
            ...invoiceData,
            dueDate: invoiceData.dueDate.toISOString(),
          }),
        });

        const newInvoice = data.invoice;
        setState((prev) => ({
          ...prev,
          invoices: [newInvoice, ...prev.invoices],
          isLoading: false,
        }));

        addNotification({
          type: "success",
          priority: "medium",
          title: "Invoice Created",
          message: `Invoice ${newInvoice.invoiceNumber} created successfully`,
          channel: ["browser"],
          persistent: false,
        });

        return newInvoice;
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));

        const errorMessage = error instanceof Error ? error.message : "Failed to create invoice";

        addNotification({
          type: "error",
          priority: "high",
          title: "Invoice Creation Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Update Invoice Status
  const updateInvoiceStatus = useCallback(
    async (invoiceId: string, status: Invoice["status"], notes?: string) => {
      try {
        const data = await apiCall(`/invoices/${invoiceId}/status`, {
          method: "PUT",
          body: JSON.stringify({ status, notes }),
        });

        const updatedInvoice = data.invoice;
        setState((prev) => ({
          ...prev,
          invoices: prev.invoices.map((inv) => (inv.id === invoiceId ? updatedInvoice : inv)),
        }));

        return updatedInvoice;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update invoice";

        addNotification({
          type: "error",
          priority: "medium",
          title: "Update Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Send Invoice
  const sendInvoice = useCallback(
    async (invoiceId: string, email?: string) => {
      try {
        await apiCall(`/invoices/${invoiceId}/send`, {
          method: "POST",
          body: JSON.stringify({ email }),
        });

        setState((prev) => ({
          ...prev,
          invoices: prev.invoices.map((inv) =>
            inv.id === invoiceId ? { ...inv, status: "sent" as const } : inv,
          ),
        }));

        addNotification({
          type: "success",
          priority: "low",
          title: "Invoice Sent",
          message: "Invoice has been sent to customer",
          channel: ["browser"],
          persistent: false,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to send invoice";

        addNotification({
          type: "error",
          priority: "medium",
          title: "Send Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Add Payment Method
  const addPaymentMethod = useCallback(
    async (
      customerId: string,
      paymentMethodData: {
        type: PaymentMethod["type"];
        token: string; // From payment gateway
        isDefault?: boolean;
        billingAddress?: Address;
      },
    ) => {
      try {
        const data = await apiCall("/payment-methods", {
          method: "POST",
          body: JSON.stringify({
            customerId,
            ...paymentMethodData,
          }),
        });

        const paymentMethod = data.paymentMethod;

        addNotification({
          type: "success",
          priority: "low",
          title: "Payment Method Added",
          message: `${paymentMethod.type} ending in ${paymentMethod.lastFour} added successfully`,
          channel: ["browser"],
          persistent: false,
        });

        return paymentMethod;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to add payment method";

        addNotification({
          type: "error",
          priority: "medium",
          title: "Payment Method Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Refund Payment
  const refundPayment = useCallback(
    async (paymentId: string, amount: number, reason: string) => {
      try {
        const data = await apiCall(`/payments/${paymentId}/refund`, {
          method: "POST",
          body: JSON.stringify({ amount, reason }),
        });

        const refundedPayment = data.payment;
        setState((prev) => ({
          ...prev,
          payments: prev.payments.map((payment) =>
            payment.id === paymentId ? refundedPayment : payment,
          ),
        }));

        addNotification({
          type: "info",
          priority: "medium",
          title: "Refund Processed",
          message: `Refund of $${amount} processed successfully`,
          channel: ["browser"],
          persistent: false,
        });

        return refundedPayment;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to process refund";

        addNotification({
          type: "error",
          priority: "high",
          title: "Refund Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Retry Failed Payment
  const retryPayment = useCallback(
    async (paymentId: string) => {
      try {
        const data = await apiCall(`/payments/${paymentId}/retry`, {
          method: "POST",
        });

        const retriedPayment = data.payment;
        setState((prev) => ({
          ...prev,
          payments: prev.payments.map((payment) =>
            payment.id === paymentId ? retriedPayment : payment,
          ),
        }));

        return retriedPayment;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to retry payment";

        addNotification({
          type: "error",
          priority: "medium",
          title: "Retry Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Initialize
  useEffect(() => {
    loadAccounts({ limit: 50 });
    loadInvoices({ limit: 50 });
    loadPayments({ limit: 50 });
    loadStats();

    if (enableRealtime) {
      connectWebSocket();
    }

    // Set up polling for non-realtime updates
    if (!enableRealtime && pollInterval > 0) {
      pollIntervalRef.current = setInterval(() => {
        loadStats();
        loadInvoices({ limit: 10 });
        loadPayments({ limit: 10 });
      }, pollInterval);
    }

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [
    loadAccounts,
    loadInvoices,
    loadPayments,
    loadStats,
    connectWebSocket,
    enableRealtime,
    pollInterval,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,

    // Actions
    processPayment,
    createInvoice,
    updateInvoiceStatus,
    sendInvoice,
    addPaymentMethod,
    refundPayment,
    retryPayment,

    // Data loaders
    loadAccounts,
    loadInvoices,
    loadPayments,
    loadStats,

    // Connection management
    connect: connectWebSocket,
    disconnect: useCallback(() => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    }, []),

    // Utils
    clearError: useCallback(() => {
      setState((prev) => ({ ...prev, error: null }));
    }, []),

    selectAccount: useCallback((account: BillingAccount | null) => {
      setState((prev) => ({ ...prev, selectedAccount: account }));
    }, []),

    // Computed values
    overdueInvoices: state.invoices.filter((inv) => inv.status === "overdue"),
    unpaidInvoices: state.invoices.filter((inv) => inv.status === "sent" && inv.amountDue > 0),
    failedPayments: state.payments.filter((payment) => payment.status === "failed"),
    pendingPayments: state.payments.filter((payment) => payment.status === "pending"),
    recentPayments: state.payments.slice(0, 10),
    totalOutstanding: state.invoices
      .filter((inv) => ["sent", "overdue"].includes(inv.status))
      .reduce((sum, inv) => sum + inv.amountDue, 0),
  };
}

export default useBilling;
