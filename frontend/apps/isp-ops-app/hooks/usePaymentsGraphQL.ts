/**
 * Payments GraphQL Hooks
 *
 * React Query hooks for payment management using GraphQL queries.
 * Provides unified invoice + payment + customer data in single queries
 * with DataLoader batching to prevent N+1 query problems.
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { graphqlClient } from "@/lib/graphql-client";

// ============================================================================
// Types
// ============================================================================

export enum PaymentStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  REFUNDED = "refunded",
  CANCELLED = "cancelled",
  REQUIRES_ACTION = "requires_action",
  REQUIRES_CAPTURE = "requires_capture",
  REQUIRES_CONFIRMATION = "requires_confirmation",
}

export enum PaymentMethodType {
  CARD = "card",
  BANK_ACCOUNT = "bank_account",
  DIGITAL_WALLET = "digital_wallet",
  CASH = "cash",
  CHECK = "check",
  WIRE_TRANSFER = "wire_transfer",
  ACH = "ach",
  CRYPTO = "crypto",
  OTHER = "other",
}

export interface PaymentCustomer {
  id: string;
  name: string;
  email: string;
  customerNumber: string | null;
}

export interface PaymentInvoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
}

export interface PaymentMethod {
  type: PaymentMethodType;
  provider: string;
  last4: string | null;
  brand: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
}

export interface Payment {
  id: string;
  paymentNumber: string | null;
  amount: number;
  currency: string;
  feeAmount: number | null;
  netAmount: number | null;
  refundAmount: number | null;
  status: PaymentStatus;
  failureReason: string | null;
  failureCode: string | null;
  paymentMethodType: PaymentMethodType;
  provider: string;
  paymentMethod: PaymentMethod | null;
  customerId: string;
  customer: PaymentCustomer | null;
  invoiceId: string | null;
  invoice: PaymentInvoice | null;
  subscriptionId: string | null;
  createdAt: string;
  processedAt: string | null;
  refundedAt: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
}

export interface PaymentConnection {
  payments: Payment[];
  totalCount: number;
  hasNextPage: boolean;
  totalAmount: number;
  totalSucceeded: number;
  totalPending: number;
  totalFailed: number;
}

export interface PaymentMetrics {
  totalPayments: number;
  succeededCount: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
  totalRevenue: number;
  pendingAmount: number;
  failedAmount: number;
  refundedAmount: number;
  successRate: number;
  averagePaymentSize: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
}

export interface PaymentFilters {
  limit?: number;
  offset?: number;
  status?: PaymentStatus;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeCustomer?: boolean;
  includeInvoice?: boolean;
}

// ============================================================================
// GraphQL Queries
// ============================================================================

const PAYMENT_FRAGMENT = `
  id
  paymentNumber
  amount
  currency
  feeAmount
  netAmount
  refundAmount
  status
  failureReason
  failureCode
  paymentMethodType
  provider
  customerId
  invoiceId
  subscriptionId
  createdAt
  processedAt
  refundedAt
  description
  metadata
`;

const PAYMENT_CUSTOMER_FRAGMENT = `
  customer {
    id
    name
    email
    customerNumber
  }
`;

const PAYMENT_INVOICE_FRAGMENT = `
  invoice {
    id
    invoiceNumber
    totalAmount
    status
  }
`;

const GET_PAYMENT_QUERY = `
  query GetPayment($id: ID!, $includeCustomer: Boolean!, $includeInvoice: Boolean!) {
    payment(id: $id, includeCustomer: $includeCustomer, includeInvoice: $includeInvoice) {
      ${PAYMENT_FRAGMENT}
      ${PAYMENT_CUSTOMER_FRAGMENT}
      ${PAYMENT_INVOICE_FRAGMENT}
    }
  }
`;

const GET_PAYMENTS_QUERY = `
  query GetPayments(
    $limit: Int
    $offset: Int
    $status: PaymentStatusEnum
    $customerId: ID
    $dateFrom: DateTime
    $dateTo: DateTime
    $includeCustomer: Boolean!
    $includeInvoice: Boolean!
  ) {
    payments(
      limit: $limit
      offset: $offset
      status: $status
      customerId: $customerId
      dateFrom: $dateFrom
      dateTo: $dateTo
      includeCustomer: $includeCustomer
      includeInvoice: $includeInvoice
    ) {
      payments {
        ${PAYMENT_FRAGMENT}
        ${PAYMENT_CUSTOMER_FRAGMENT}
        ${PAYMENT_INVOICE_FRAGMENT}
      }
      totalCount
      hasNextPage
      totalAmount
      totalSucceeded
      totalPending
      totalFailed
    }
  }
`;

const GET_PAYMENT_METRICS_QUERY = `
  query GetPaymentMetrics($dateFrom: DateTime, $dateTo: DateTime) {
    paymentMetrics(dateFrom: $dateFrom, dateTo: $dateTo) {
      totalPayments
      succeededCount
      pendingCount
      failedCount
      refundedCount
      totalRevenue
      pendingAmount
      failedAmount
      refundedAmount
      successRate
      averagePaymentSize
      todayRevenue
      weekRevenue
      monthRevenue
    }
  }
`;

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get a single payment by ID with customer and invoice data
 */
export function usePayment(
  paymentId: string,
  options: {
    includeCustomer?: boolean;
    includeInvoice?: boolean;
    enabled?: boolean;
  } = {},
): UseQueryResult<Payment, Error> {
  const { includeCustomer = true, includeInvoice = true, enabled = true } = options;

  return useQuery({
    queryKey: ["payment", paymentId, includeCustomer, includeInvoice],
    queryFn: async () => {
      const response = await graphqlClient.request<{ payment: Payment }>(GET_PAYMENT_QUERY, {
        id: paymentId,
        includeCustomer,
        includeInvoice,
      });
      return response.payment;
    },
    enabled: enabled && !!paymentId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get paginated list of payments with optional filters
 *
 * Benefits:
 * - Unified invoice + payment + customer in single query
 * - DataLoader batching prevents N+1 queries
 * - Server-side filtering and pagination
 * - Aggregated metrics (total amount, succeeded, pending, failed)
 */
export function usePayments(
  filters: PaymentFilters = {},
  enabled = true,
): UseQueryResult<PaymentConnection, Error> {
  const {
    limit = 50,
    offset = 0,
    status,
    customerId,
    dateFrom,
    dateTo,
    includeCustomer = true,
    includeInvoice = false,
  } = filters;

  return useQuery({
    queryKey: ["payments", filters],
    queryFn: async () => {
      const response = await graphqlClient.request<{
        payments: PaymentConnection;
      }>(GET_PAYMENTS_QUERY, {
        limit,
        offset,
        status,
        customerId,
        dateFrom,
        dateTo,
        includeCustomer,
        includeInvoice,
      });
      return response.payments;
    },
    enabled,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get payment metrics and statistics
 *
 * Provides:
 * - Total payments by status (succeeded, pending, failed, refunded)
 * - Revenue metrics (total, today, week, month)
 * - Success rate and average payment size
 */
export function usePaymentMetrics(
  options: {
    dateFrom?: string;
    dateTo?: string;
    enabled?: boolean;
  } = {},
): UseQueryResult<PaymentMetrics, Error> {
  const { dateFrom, dateTo, enabled = true } = options;

  return useQuery({
    queryKey: ["payment-metrics", dateFrom, dateTo],
    queryFn: async () => {
      const response = await graphqlClient.request<{
        paymentMetrics: PaymentMetrics;
      }>(GET_PAYMENT_METRICS_QUERY, { dateFrom, dateTo });
      return response.paymentMetrics;
    },
    enabled,
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Get payments for a specific customer
 * Convenience hook that wraps usePayments with customerId filter
 */
export function useCustomerPayments(
  customerId: string,
  options: {
    limit?: number;
    offset?: number;
    status?: PaymentStatus;
    includeInvoice?: boolean;
    enabled?: boolean;
  } = {},
): UseQueryResult<PaymentConnection, Error> {
  const { limit = 20, offset = 0, status, includeInvoice = true, enabled = true } = options;

  const filters: PaymentFilters = {
    customerId,
    limit,
    offset,
    includeCustomer: false, // Already know the customer
    includeInvoice,
    ...(status !== undefined && { status }),
  };

  return usePayments(filters, enabled && !!customerId);
}

/**
 * Get recent payments (last 7 days)
 * Convenience hook for dashboard widgets
 */
export function useRecentPayments(
  limit = 10,
  enabled = true,
): UseQueryResult<PaymentConnection, Error> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return usePayments(
    {
      limit,
      offset: 0,
      dateFrom: sevenDaysAgo.toISOString(),
      includeCustomer: true,
      includeInvoice: false,
    },
    enabled,
  );
}

/**
 * Get failed payments requiring attention
 * Convenience hook for monitoring failed transactions
 */
export function useFailedPayments(
  limit = 20,
  enabled = true,
): UseQueryResult<PaymentConnection, Error> {
  return usePayments(
    {
      limit,
      offset: 0,
      status: PaymentStatus.FAILED,
      includeCustomer: true,
      includeInvoice: true,
    },
    enabled,
  );
}
