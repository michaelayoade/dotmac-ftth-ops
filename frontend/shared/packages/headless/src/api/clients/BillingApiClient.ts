/**
 * Billing Management API Client
 * Handles invoices, payments, subscriptions
 */

import { BaseApiClient } from "./BaseApiClient";
import type { PaginatedResponse, QueryParams } from "../types/api";
import type {
  PaymentProcessor,
  Transaction,
  Invoice,
  CreatePaymentIntentRequest,
  PaymentIntent,
} from "../../types/billing";

export class BillingApiClient extends BaseApiClient {
  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    super(baseURL, defaultHeaders);
  }

  // Payment processor operations
  async getBillingProcessors(params?: QueryParams): Promise<PaginatedResponse<PaymentProcessor>> {
    return this.get("/api/billing/processors", { params });
  }

  async updateBillingProcessor(
    processorId: string,
    data: any,
  ): Promise<{ data: PaymentProcessor }> {
    return this.put(`/api/billing/processors/${processorId}`, data);
  }

  async testBillingProcessor(processorId: string, params?: any): Promise<{ success: boolean }> {
    return this.post(`/api/billing/processors/${processorId}/test`, params);
  }

  // Payment operations
  async createPaymentIntent(data: CreatePaymentIntentRequest): Promise<{ data: PaymentIntent }> {
    return this.post("/api/billing/payment-intents", data);
  }

  async confirmPaymentIntent(data: any): Promise<{ data: PaymentIntent }> {
    return this.post("/api/billing/payment-intents/confirm", data);
  }

  async capturePaymentIntent(
    paymentIntentId: string,
    data?: any,
  ): Promise<{ data: PaymentIntent }> {
    return this.post(`/api/billing/payment-intents/${paymentIntentId}/capture`, data);
  }

  async cancelPaymentIntent(paymentIntentId: string, data?: any): Promise<{ data: PaymentIntent }> {
    return this.post(`/api/billing/payment-intents/${paymentIntentId}/cancel`, data);
  }

  // Transaction operations
  async getTransactions(params?: QueryParams): Promise<PaginatedResponse<Transaction>> {
    return this.get("/api/billing/transactions", { params });
  }

  async getTransaction(transactionId: string, params?: any): Promise<{ data: Transaction }> {
    return this.get(`/api/billing/transactions/${transactionId}`, { params });
  }

  async processRefund(data: any): Promise<{ data: Transaction }> {
    return this.post("/api/billing/refunds", data);
  }

  // Invoice operations
  async getInvoices(params?: QueryParams): Promise<PaginatedResponse<Invoice>> {
    return this.get("/api/billing/invoices", { params });
  }

  async getInvoice(invoiceId: string): Promise<{ data: Invoice }> {
    return this.get(`/api/billing/invoices/${invoiceId}`);
  }

  async createInvoice(data: any): Promise<{ data: Invoice }> {
    return this.post("/api/billing/invoices", data);
  }

  // Analytics operations
  async getBillingAnalytics(params?: any): Promise<{ data: any }> {
    return this.get("/api/billing/analytics", { params });
  }

  async generateBillingReport(params?: any): Promise<{ data: Blob }> {
    return this.post("/api/billing/reports", params);
  }

  // Utility operations
  async calculateProcessorFees(processorId: string, params?: any): Promise<{ data: any }> {
    return this.post(`/api/billing/processors/${processorId}/calculate-fees`, params);
  }

  async tokenizePaymentMethod(data: any): Promise<{ data: any }> {
    return this.post("/api/billing/tokenize", data);
  }

  async encryptBillingData(data: any): Promise<{ data: any }> {
    return this.post("/api/billing/encrypt", data);
  }
}
