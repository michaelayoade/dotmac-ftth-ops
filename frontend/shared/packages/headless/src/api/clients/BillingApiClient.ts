/**
 * Billing Management API Client
 * Handles invoices, payments, subscriptions
 */

import type {
  PaymentProcessor,
  Transaction,
  Invoice,
  CreatePaymentIntentRequest,
  PaymentIntent,
} from "../../types/billing";
import type { PaginatedResponse, QueryParams } from "../types/api";

import { BaseApiClient } from "./BaseApiClient";

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

  async sendInvoice(invoiceId: string): Promise<{ data: Invoice }> {
    return this.post(`/api/billing/invoices/${invoiceId}/send`);
  }

  // Customer billing operations
  async getCustomerBillingSummary(customerId: string): Promise<{ data: any }> {
    return this.get(`/api/billing/customers/${customerId}/summary`);
  }

  async updateBillingAddress(customerId: string, data: any): Promise<{ data: any }> {
    return this.put(`/api/billing/customers/${customerId}/address`, data);
  }

  async savePaymentMethod(customerId: string, data: any): Promise<{ data: any }> {
    return this.post(`/api/billing/customers/${customerId}/payment-methods`, data);
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

  // Payment method operations
  async getPaymentMethods(params?: QueryParams): Promise<PaginatedResponse<any>> {
    return this.get("/api/billing/payment-methods", { params });
  }

  async getPaymentMethod(paymentMethodId: string): Promise<{ data: any }> {
    return this.get(`/api/billing/payment-methods/${paymentMethodId}`);
  }

  async createPaymentMethod(data: any): Promise<{ data: any }> {
    return this.post("/api/billing/payment-methods", data);
  }

  async deletePaymentMethod(paymentMethodId: string): Promise<{ success: boolean }> {
    return this.delete(`/api/billing/payment-methods/${paymentMethodId}`);
  }

  // Subscription operations
  async getSubscriptions(params?: QueryParams): Promise<PaginatedResponse<any>> {
    return this.get("/api/billing/subscriptions", { params });
  }

  async getSubscription(subscriptionId: string): Promise<{ data: any }> {
    return this.get(`/api/billing/subscriptions/${subscriptionId}`);
  }

  async createSubscription(data: any): Promise<{ data: any }> {
    return this.post("/api/billing/subscriptions", data);
  }

  async updateSubscription(subscriptionId: string, data: any): Promise<{ data: any }> {
    return this.put(`/api/billing/subscriptions/${subscriptionId}`, data);
  }

  async cancelSubscription(subscriptionId: string, data?: any): Promise<{ data: any }> {
    return this.post(`/api/billing/subscriptions/${subscriptionId}/cancel`, data);
  }

  // Payment processing
  async processPayment(data: any): Promise<{ data: Transaction }> {
    return this.post("/api/billing/payments", data);
  }

  async getCustomerBilling(customerId: string, params?: QueryParams): Promise<{ data: any }> {
    return this.get(`/api/billing/customers/${customerId}/billing`, { params });
  }

  async getBillingHistory(customerId: string, params?: QueryParams): Promise<{ data: any[] }> {
    return this.get(`/api/billing/customers/${customerId}/billing/history`, { params });
  }
}
