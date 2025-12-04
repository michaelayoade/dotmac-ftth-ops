/**
 * Payment Processor Hooks Tests
 * Comprehensive test suite for payment processing functionality
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import {
  usePaymentProcessor,
  useStripePayments,
  usePayPalPayments,
  PaymentProvider,
} from "../payment/usePaymentProcessor";

// Mock Stripe
const mockStripe = {
  confirmCardPayment: jest.fn(),
  confirmPaymentIntent: jest.fn(),
  createPaymentMethod: jest.fn(),
  retrievePaymentIntent: jest.fn(),
  elements: jest.fn(() => ({
    create: jest.fn(),
    getElement: jest.fn(),
  })),
};

const mockStripeElements = {
  create: jest.fn(),
  getElement: jest.fn(() => ({
    mount: jest.fn(),
    unmount: jest.fn(),
    focus: jest.fn(),
    clear: jest.fn(),
  })),
};

// Mock PayPal
const mockPayPal = {
  Buttons: jest.fn(() => ({
    render: jest.fn(),
  })),
  FUNDING: {
    PAYPAL: "paypal",
    CREDIT: "credit",
    DEBIT: "debit",
  },
};

// Mock API client
const mockBillingClient = {
  createPaymentIntent: jest.fn(),
  confirmPayment: jest.fn(),
  processRefund: jest.fn(),
  getPaymentMethods: jest.fn(),
  savePaymentMethod: jest.fn(),
  deletePaymentMethod: jest.fn(),
};

// Mock window.paypal
Object.defineProperty(window, "paypal", {
  value: mockPayPal,
  writable: true,
});

// Test wrapper
const TestWrapper = ({ children, config }: { children: ReactNode; config?: any }) => (
  <PaymentProvider
    config={
      config || {
        stripe: { publishableKey: "pk_test_123" },
        paypal: { clientId: "test_client_id" },
      }
    }
  >
    {children}
  </PaymentProvider>
);

describe("Payment Processor Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mocks
    mockStripe.confirmCardPayment.mockResolvedValue({
      paymentIntent: { status: "succeeded", id: "pi_test_123" },
    });

    mockStripe.createPaymentMethod.mockResolvedValue({
      paymentMethod: { id: "pm_test_123", type: "card" },
    });

    mockBillingClient.createPaymentIntent.mockResolvedValue({
      data: { client_secret: "pi_test_123_secret", amount: 2999 },
    });
  });

  describe("usePaymentProcessor", () => {
    it("should initialize with default state", () => {
      const { result } = renderHook(() => usePaymentProcessor(), {
        wrapper: TestWrapper,
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.supportedMethods).toEqual(["stripe", "paypal"]);
    });

    it("should check payment method support", () => {
      const { result } = renderHook(() => usePaymentProcessor(), {
        wrapper: TestWrapper,
      });

      expect(result.current.isMethodSupported("stripe")).toBe(true);
      expect(result.current.isMethodSupported("paypal")).toBe(true);
      expect(result.current.isMethodSupported("apple_pay")).toBe(false);
    });

    it("should validate payment data", () => {
      const { result } = renderHook(() => usePaymentProcessor(), {
        wrapper: TestWrapper,
      });

      // Valid payment data
      const validData = {
        amount: 2999,
        currency: "USD",
        method: "stripe" as const,
        customer_id: "cust_123",
      };

      expect(result.current.validatePaymentData(validData)).toEqual({
        valid: true,
        errors: [],
      });

      // Invalid payment data
      const invalidData = {
        amount: -100,
        currency: "",
        method: "invalid" as any,
        customer_id: "",
      };

      const validation = result.current.validatePaymentData(invalidData);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Amount must be positive");
      expect(validation.errors).toContain("Currency is required");
      expect(validation.errors).toContain("Customer ID is required");
    });

    it("should format currency correctly", () => {
      const { result } = renderHook(() => usePaymentProcessor(), {
        wrapper: TestWrapper,
      });

      expect(result.current.formatCurrency(2999, "USD")).toBe("$29.99");
      expect(result.current.formatCurrency(1000, "EUR")).toBe("€10.00");
      expect(result.current.formatCurrency(500, "GBP")).toBe("£5.00");
    });

    describe("Error Handling", () => {
      it("should handle payment processing errors", async () => {
        const { result } = renderHook(() => usePaymentProcessor(), {
          wrapper: TestWrapper,
        });

        const invalidPaymentData = {
          amount: 0,
          currency: "USD",
          method: "stripe" as const,
          customer_id: "cust_123",
        };

        await act(async () => {
          await expect(result.current.processPayment(invalidPaymentData)).rejects.toThrow();
        });
      });

      it("should clear errors when new payment is initiated", async () => {
        const { result } = renderHook(() => usePaymentProcessor(), {
          wrapper: TestWrapper,
        });

        // Simulate error
        await act(async () => {
          try {
            await result.current.processPayment({
              amount: 0,
              currency: "USD",
              method: "stripe" as const,
              customer_id: "cust_123",
            });
          } catch (e) {
            // Expected error
          }
        });

        expect(result.current.error).toBeTruthy();

        // Start new payment
        await act(async () => {
          result.current.processPayment({
            amount: 2999,
            currency: "USD",
            method: "stripe" as const,
            customer_id: "cust_123",
          });
        });

        expect(result.current.error).toBeNull();
      });
    });
  });

  describe("useStripePayments", () => {
    it("should initialize Stripe correctly", async () => {
      const { result } = renderHook(() => useStripePayments(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.error).toBeNull();
    });

    it("should create payment intent", async () => {
      const { result } = renderHook(() => useStripePayments(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await act(async () => {
        const intent = await result.current.createPaymentIntent({
          amount: 2999,
          currency: "USD",
          customer_id: "cust_123",
        });

        expect(intent.client_secret).toBe("pi_test_123_secret");
      });

      expect(mockBillingClient.createPaymentIntent).toHaveBeenCalledWith({
        amount: 2999,
        currency: "USD",
        customer_id: "cust_123",
        payment_method_types: ["card"],
      });
    });

    it("should confirm card payment", async () => {
      const { result } = renderHook(() => useStripePayments(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await act(async () => {
        const paymentResult = await result.current.confirmCardPayment("pi_test_123_secret", {
          payment_method: {
            card: mockStripeElements.getElement("card"),
            billing_details: {
              name: "John Doe",
              email: "john@example.com",
            },
          },
        });

        expect(paymentResult.paymentIntent.status).toBe("succeeded");
      });
    });

    it("should handle payment failures", async () => {
      mockStripe.confirmCardPayment.mockResolvedValueOnce({
        error: {
          type: "card_error",
          code: "card_declined",
          message: "Your card was declined.",
        },
      });

      const { result } = renderHook(() => useStripePayments(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await act(async () => {
        const paymentResult = await result.current.confirmCardPayment("pi_test_123_secret", {
          payment_method: { card: mockStripeElements.getElement("card") },
        });

        expect(paymentResult.error).toBeDefined();
        expect(paymentResult.error.message).toBe("Your card was declined.");
      });
    });

    it("should save payment method", async () => {
      mockBillingClient.savePaymentMethod.mockResolvedValue({
        data: { id: "pm_saved_123", type: "card" },
      });

      const { result } = renderHook(() => useStripePayments(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await act(async () => {
        const savedMethod = await result.current.savePaymentMethod("cust_123", "pm_test_123");

        expect(savedMethod.id).toBe("pm_saved_123");
      });

      expect(mockBillingClient.savePaymentMethod).toHaveBeenCalledWith("cust_123", "pm_test_123");
    });
  });

  describe("usePayPalPayments", () => {
    it("should initialize PayPal correctly", async () => {
      const { result } = renderHook(() => usePayPalPayments(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.error).toBeNull();
    });

    it("should create PayPal order", async () => {
      const { result } = renderHook(() => usePayPalPayments(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await act(async () => {
        const order = await result.current.createOrder({
          amount: 29.99,
          currency: "USD",
          customer_id: "cust_123",
        });

        expect(order).toBeDefined();
        expect(typeof order.orderID).toBe("string");
      });
    });

    it("should handle PayPal approval", async () => {
      const { result } = renderHook(() => usePayPalPayments(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const mockOrderData = {
        orderID: "ORDER123",
        payerID: "PAYER123",
        paymentID: "PAYMENT123",
      };

      await act(async () => {
        const result_data = await result.current.onApprove(mockOrderData);
        expect(result_data.status).toBe("COMPLETED");
      });
    });

    it("should handle PayPal errors", async () => {
      const { result } = renderHook(() => usePayPalPayments(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await act(async () => {
        const errorData = { message: "Payment cancelled by user" };
        result.current.onError(errorData);
      });

      expect(result.current.error).toBe("Payment cancelled by user");
    });
  });

  describe("Payment Method Management", () => {
    it("should fetch saved payment methods", async () => {
      const mockPaymentMethods = [
        { id: "pm_1", type: "card", card: { brand: "visa", last4: "4242" } },
        {
          id: "pm_2",
          type: "card",
          card: { brand: "mastercard", last4: "5555" },
        },
      ];

      mockBillingClient.getPaymentMethods.mockResolvedValue({
        data: mockPaymentMethods,
      });

      const { result } = renderHook(() => usePaymentProcessor(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        const methods = await result.current.getPaymentMethods("cust_123");
        expect(methods).toEqual(mockPaymentMethods);
      });

      expect(mockBillingClient.getPaymentMethods).toHaveBeenCalledWith("cust_123");
    });

    it("should delete payment method", async () => {
      mockBillingClient.deletePaymentMethod.mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => usePaymentProcessor(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        const result_data = await result.current.deletePaymentMethod("pm_123");
        expect(result_data.success).toBe(true);
      });

      expect(mockBillingClient.deletePaymentMethod).toHaveBeenCalledWith("pm_123");
    });
  });

  describe("Refund Processing", () => {
    it("should process refund", async () => {
      mockBillingClient.processRefund.mockResolvedValue({
        data: { id: "re_123", amount: 1000, status: "succeeded" },
      });

      const { result } = renderHook(() => usePaymentProcessor(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        const refund = await result.current.processRefund("pi_123", 1000, "Customer request");
        expect(refund.status).toBe("succeeded");
        expect(refund.amount).toBe(1000);
      });

      expect(mockBillingClient.processRefund).toHaveBeenCalledWith(
        "pi_123",
        1000,
        "Customer request",
      );
    });
  });

  describe("Security Features", () => {
    it("should validate payment amounts", () => {
      const { result } = renderHook(() => usePaymentProcessor(), {
        wrapper: TestWrapper,
      });

      // Test various invalid amounts
      expect(
        result.current.validatePaymentData({
          amount: -100,
          currency: "USD",
          method: "stripe",
          customer_id: "test",
        }).valid,
      ).toBe(false);

      expect(
        result.current.validatePaymentData({
          amount: 0,
          currency: "USD",
          method: "stripe",
          customer_id: "test",
        }).valid,
      ).toBe(false);

      expect(
        result.current.validatePaymentData({
          amount: 10000000,
          currency: "USD",
          method: "stripe",
          customer_id: "test",
        }).valid,
      ).toBe(false);

      // Valid amount
      expect(
        result.current.validatePaymentData({
          amount: 2999,
          currency: "USD",
          method: "stripe",
          customer_id: "test",
        }).valid,
      ).toBe(true);
    });

    it("should sanitize payment data", () => {
      const { result } = renderHook(() => usePaymentProcessor(), {
        wrapper: TestWrapper,
      });

      const dirtyData = {
        amount: 2999,
        currency: "USD",
        method: "stripe" as const,
        customer_id: "cust_123",
        // These should be filtered out
        creditCardNumber: "4242424242424242",
        cvv: "123",
        ssn: "123-45-6789",
      };

      const sanitized = result.current.sanitizePaymentData(dirtyData);

      expect(sanitized).not.toHaveProperty("creditCardNumber");
      expect(sanitized).not.toHaveProperty("cvv");
      expect(sanitized).not.toHaveProperty("ssn");
      expect(sanitized.amount).toBe(2999);
      expect(sanitized.customer_id).toBe("cust_123");
    });
  });

  describe("Configuration", () => {
    it("should handle missing configuration", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => usePaymentProcessor(), {
          wrapper: ({ children }) => <PaymentProvider config={{}}>{children}</PaymentProvider>,
        });
      }).toThrow();

      consoleSpy.mockRestore();
    });

    it("should validate configuration on initialization", () => {
      const invalidConfig = {
        stripe: { publishableKey: "" }, // Invalid empty key
        paypal: { clientId: "test_client_id" },
      };

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      renderHook(() => usePaymentProcessor(), {
        wrapper: ({ children }) => (
          <PaymentProvider config={invalidConfig}>{children}</PaymentProvider>
        ),
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid Stripe configuration"),
      );

      consoleSpy.mockRestore();
    });
  });
});
