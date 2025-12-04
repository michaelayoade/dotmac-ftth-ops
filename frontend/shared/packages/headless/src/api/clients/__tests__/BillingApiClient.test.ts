/**
 * BillingApiClient Tests
 * Critical test suite for billing operations
 */

import { BillingApiClient } from "../BillingApiClient";

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("BillingApiClient", () => {
  let client: BillingApiClient;
  const baseURL = "https://api.test.com";
  const defaultHeaders = { Authorization: "Bearer test-token" };

  beforeEach(() => {
    client = new BillingApiClient(baseURL, defaultHeaders);
    jest.clearAllMocks();
  });

  const mockResponse = <T>(data: T, status = 200) => {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    } as Response);
  };

  describe("Invoice Management", () => {
    const mockInvoice = {
      id: "inv_123",
      customer_id: "cust_123",
      invoice_number: "INV-2024-001",
      amount: 9999,
      tax: 800,
      total: 10799,
      status: "SENT",
      due_date: "2024-02-01T00:00:00Z",
      items: [],
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    it("should create invoice", async () => {
      mockResponse({ data: mockInvoice });

      const invoiceData = {
        customer_id: "cust_123",
        amount: 9999,
        due_date: "2024-02-01T00:00:00Z",
        items: [{ description: "Service charge", amount: 9999 }],
      };

      const result = await client.createInvoice(invoiceData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/billing/invoices",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(invoiceData),
        }),
      );

      expect(result.data.id).toBe("inv_123");
    });

    it("should get invoices with filters", async () => {
      mockResponse({
        data: [mockInvoice],
        pagination: expect.any(Object),
      });

      await client.getInvoices({
        customer_id: "cust_123",
        status: "SENT",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/billing/invoices?customer_id=cust_123&status=SENT",
        expect.any(Object),
      );
    });

    it("should send invoice", async () => {
      mockResponse({ data: { ...mockInvoice, status: "SENT" } });

      const result = await client.sendInvoice("inv_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/billing/invoices/inv_123/send",
        expect.objectContaining({
          method: "POST",
        }),
      );

      expect(result.data.status).toBe("SENT");
    });
  });

  describe("Payment Processing", () => {
    it("should process payment", async () => {
      const paymentData = {
        invoice_id: "inv_123",
        amount: 10799,
        payment_method: "credit_card",
        payment_method_id: "pm_123",
      };

      mockResponse({
        data: {
          id: "pay_123",
          status: "succeeded",
          amount: 10799,
        },
      });

      const result = await client.processPayment(paymentData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/billing/payments",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(paymentData),
        }),
      );

      expect(result.data.status).toBe("succeeded");
    });

    it("should handle payment failures", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        statusText: "Payment Required",
        json: async () => ({
          error: { code: "PAYMENT_FAILED", message: "Insufficient funds" },
        }),
      } as Response);

      await expect(
        client.processPayment({
          invoice_id: "inv_123",
          amount: 10799,
          payment_method: "credit_card",
          payment_method_id: "pm_123",
        }),
      ).rejects.toThrow("Payment Required");
    });
  });

  describe("Customer Billing", () => {
    it("should get customer billing summary", async () => {
      const summary = {
        total_outstanding: 25999,
        overdue_amount: 5000,
        total_invoices: 12,
        paid_invoices: 8,
        last_payment_date: "2024-01-15T00:00:00Z",
      };

      mockResponse({ data: summary });

      const result = await client.getCustomerBillingSummary("cust_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/billing/customers/cust_123/summary",
        expect.any(Object),
      );

      expect(result.data.total_outstanding).toBe(25999);
    });

    it("should update billing address", async () => {
      const address = {
        street: "456 New St",
        city: "New City",
        state: "NY",
        zip: "10001",
        country: "US",
      };

      mockResponse({ data: { billing_address: address } });

      const result = await client.updateBillingAddress("cust_123", address);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/billing/customers/cust_123/billing-address",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(address),
        }),
      );

      expect(result.data.billing_address.city).toBe("New City");
    });
  });

  describe("Payment Methods", () => {
    it("should save payment method", async () => {
      const paymentMethod = {
        id: "pm_123",
        type: "card",
        card: { brand: "visa", last4: "4242" },
      };

      mockResponse({ data: paymentMethod });

      const result = await client.savePaymentMethod("cust_123", "pm_123");

      expect(result.data.id).toBe("pm_123");
    });

    it("should delete payment method", async () => {
      mockResponse({ success: true });

      const result = await client.deletePaymentMethod("pm_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/billing/payment-methods/pm_123",
        expect.objectContaining({
          method: "DELETE",
        }),
      );

      expect(result.success).toBe(true);
    });
  });

  describe("Subscription Management", () => {
    it("should create subscription", async () => {
      const subscriptionData = {
        customer_id: "cust_123",
        plan_id: "plan_pro",
        billing_cycle: "MONTHLY",
      };

      const subscription = {
        id: "sub_123",
        status: "ACTIVE",
        current_period_start: "2024-01-01T00:00:00Z",
        current_period_end: "2024-02-01T00:00:00Z",
      };

      mockResponse({ data: subscription });

      const result = await client.createSubscription(subscriptionData);

      expect(result.data.status).toBe("ACTIVE");
    });

    it("should cancel subscription", async () => {
      mockResponse({
        data: {
          id: "sub_123",
          status: "CANCELLED",
          cancelled_at: "2024-01-15T00:00:00Z",
        },
      });

      const result = await client.cancelSubscription("sub_123", {
        reason: "Customer request",
      });

      expect(result.data.status).toBe("CANCELLED");
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(client.getInvoices()).rejects.toThrow("Network error");
    });

    it("should handle invalid payment data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: { code: "INVALID_AMOUNT", message: "Amount must be positive" },
        }),
      } as Response);

      await expect(
        client.processPayment({
          invoice_id: "inv_123",
          amount: -100,
          payment_method: "credit_card",
          payment_method_id: "pm_123",
        }),
      ).rejects.toThrow("Bad Request");
    });
  });
});
