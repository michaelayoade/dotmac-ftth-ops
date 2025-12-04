import { renderHook, act, waitFor } from "@testing-library/react";
import { useBilling } from "../useBilling";
import {
  createHookWrapper,
  mockInvoice,
  mockPayment,
  server,
  simulateAPIError,
  simulateNetworkDelay,
  createMockWebSocket,
} from "@dotmac/testing";

// Mock fetch globally
global.fetch = jest.fn();

// Mock WebSocket
const mockWebSocket = createMockWebSocket();
(global as any).WebSocket = jest.fn(() => mockWebSocket.mockWS);

describe("useBilling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe("Initialization", () => {
    it("initializes with default state", () => {
      const { result } = renderHook(() => useBilling());

      expect(result.current.invoices).toEqual([]);
      expect(result.current.payments).toEqual([]);
      expect(result.current.accounts).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.paymentProcessing).toBe(false);
      expect(result.current.totalOutstanding).toBe(0);
    });

    it("loads initial data on mount", async () => {
      const mockInvoices = [mockInvoice(), mockInvoice()];
      const mockPayments = [mockPayment(), mockPayment()];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accounts: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ invoices: mockInvoices }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ payments: mockPayments }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ stats: {} }),
        });

      const { result } = renderHook(() => useBilling());

      await waitFor(() => {
        expect(result.current.invoices).toEqual(mockInvoices);
        expect(result.current.payments).toEqual(mockPayments);
      });
    });
  });

  describe("Invoice Management", () => {
    it("creates invoice successfully", async () => {
      const newInvoice = mockInvoice();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoice: newInvoice }),
      });

      const { result } = renderHook(() => useBilling());

      await act(async () => {
        const invoice = await result.current.createInvoice({
          customerId: "customer_123",
          dueDate: new Date("2024-02-01"),
          lineItems: [
            {
              description: "Service Fee",
              quantity: 1,
              unitPrice: 99.99,
            },
          ],
        });

        expect(invoice).toEqual(newInvoice);
      });

      expect(result.current.invoices).toContainEqual(newInvoice);
    });

    it("handles invoice creation errors", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Validation failed"));

      const { result } = renderHook(() => useBilling());

      await act(async () => {
        try {
          await result.current.createInvoice({
            customerId: "invalid",
            dueDate: new Date(),
            lineItems: [],
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain("Validation failed");
        }
      });
    });

    it("updates invoice status", async () => {
      const existingInvoice = mockInvoice({ id: "inv_123", status: "draft" });
      const updatedInvoice = { ...existingInvoice, status: "sent" };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoice: updatedInvoice }),
      });

      const { result } = renderHook(() => useBilling());

      // Add existing invoice to state
      act(() => {
        result.current.invoices.push(existingInvoice);
      });

      await act(async () => {
        await result.current.updateInvoiceStatus("inv_123", "sent");
      });

      expect(result.current.invoices.find((inv) => inv.id === "inv_123")?.status).toBe("sent");
    });

    it("sends invoice via email", async () => {
      const invoice = mockInvoice({ id: "inv_123", status: "draft" });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useBilling());

      act(() => {
        result.current.invoices.push(invoice);
      });

      await act(async () => {
        await result.current.sendInvoice("inv_123", "customer@example.com");
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/billing/invoices/inv_123/send",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "customer@example.com" }),
        }),
      );

      expect(result.current.invoices.find((inv) => inv.id === "inv_123")?.status).toBe("sent");
    });
  });

  describe("Payment Processing", () => {
    it("processes payment successfully", async () => {
      const newPayment = mockPayment({ status: "completed" });
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ payment: newPayment }),
      });

      const { result } = renderHook(() => useBilling());

      await act(async () => {
        const payment = await result.current.processPayment({
          invoiceId: "inv_123",
          amount: 99.99,
          paymentMethodId: "pm_123",
        });

        expect(payment).toEqual(newPayment);
        expect(result.current.paymentProcessing).toBe(false);
      });

      expect(result.current.payments).toContainEqual(newPayment);
    });

    it("handles payment processing errors", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Payment declined"));

      const { result } = renderHook(() => useBilling());

      await act(async () => {
        try {
          await result.current.processPayment({
            invoiceId: "inv_123",
            amount: 99.99,
            paymentMethodId: "pm_invalid",
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain("Payment declined");
        }
      });

      expect(result.current.paymentProcessing).toBe(false);
    });

    it("sets processing state during payment", async () => {
      let resolvePayment: (value: any) => void;
      const paymentPromise = new Promise((resolve) => {
        resolvePayment = resolve;
      });

      (fetch as jest.Mock).mockReturnValueOnce(paymentPromise);

      const { result } = renderHook(() => useBilling());

      act(() => {
        result.current.processPayment({
          invoiceId: "inv_123",
          amount: 99.99,
          paymentMethodId: "pm_123",
        });
      });

      expect(result.current.paymentProcessing).toBe(true);

      await act(async () => {
        resolvePayment({
          ok: true,
          json: async () => ({ payment: mockPayment() }),
        });
      });

      expect(result.current.paymentProcessing).toBe(false);
    });

    it("retries failed payments", async () => {
      const retriedPayment = mockPayment({ status: "pending" });
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ payment: retriedPayment }),
      });

      const { result } = renderHook(() => useBilling());

      const failedPayment = mockPayment({ id: "pay_123", status: "failed" });
      act(() => {
        result.current.payments.push(failedPayment);
      });

      await act(async () => {
        await result.current.retryPayment("pay_123");
      });

      expect(result.current.payments.find((p) => p.id === "pay_123")?.status).toBe("pending");
    });

    it("processes refunds", async () => {
      const refundedPayment = mockPayment({
        id: "pay_123",
        refundedAmount: 50.0,
      });
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ payment: refundedPayment }),
      });

      const { result } = renderHook(() => useBilling());

      const completedPayment = mockPayment({
        id: "pay_123",
        status: "completed",
        amount: 100.0,
      });
      act(() => {
        result.current.payments.push(completedPayment);
      });

      await act(async () => {
        await result.current.refundPayment("pay_123", 50.0, "Customer request");
      });

      expect(result.current.payments.find((p) => p.id === "pay_123")?.refundedAmount).toBe(50.0);
    });
  });

  describe("WebSocket Integration", () => {
    it("connects to WebSocket on mount", () => {
      renderHook(() =>
        useBilling({
          websocketEndpoint: "ws://localhost:8080",
          enableRealtime: true,
        }),
      );

      expect(WebSocket).toHaveBeenCalledWith("ws://localhost:8080/?");
    });

    it("handles payment completion messages", async () => {
      const { result } = renderHook(() =>
        useBilling({
          websocketEndpoint: "ws://localhost:8080",
          enableRealtime: true,
        }),
      );

      const paymentMessage = {
        type: "payment_completed",
        payment: mockPayment({ amount: 199.99 }),
      };

      act(() => {
        mockWebSocket.simulateOpen();
        mockWebSocket.simulateMessage(paymentMessage);
      });

      await waitFor(() => {
        expect(result.current.payments).toHaveLength(1);
        expect(result.current.payments[0].amount).toBe(199.99);
      });
    });

    it("handles payment failure messages", async () => {
      const { result } = renderHook(() =>
        useBilling({
          websocketEndpoint: "ws://localhost:8080",
          enableRealtime: true,
        }),
      );

      const existingPayment = mockPayment({ id: "pay_123", status: "pending" });
      act(() => {
        result.current.payments.push(existingPayment);
      });

      const failureMessage = {
        type: "payment_failed",
        paymentId: "pay_123",
        reason: "Insufficient funds",
      };

      act(() => {
        mockWebSocket.simulateOpen();
        mockWebSocket.simulateMessage(failureMessage);
      });

      await waitFor(() => {
        const payment = result.current.payments.find((p) => p.id === "pay_123");
        expect(payment?.status).toBe("failed");
        expect(payment?.failureReason).toBe("Insufficient funds");
      });
    });

    it("handles invoice status updates", async () => {
      const { result } = renderHook(() =>
        useBilling({
          websocketEndpoint: "ws://localhost:8080",
          enableRealtime: true,
        }),
      );

      const existingInvoice = mockInvoice({ id: "inv_123", status: "sent" });
      act(() => {
        result.current.invoices.push(existingInvoice);
      });

      const overdueMessage = {
        type: "invoice_overdue",
        invoiceId: "inv_123",
        invoiceNumber: "INV-001",
      };

      act(() => {
        mockWebSocket.simulateOpen();
        mockWebSocket.simulateMessage(overdueMessage);
      });

      await waitFor(() => {
        const invoice = result.current.invoices.find((inv) => inv.id === "inv_123");
        expect(invoice?.status).toBe("overdue");
      });
    });

    it("handles WebSocket reconnection", async () => {
      const { result } = renderHook(() =>
        useBilling({
          websocketEndpoint: "ws://localhost:8080",
          enableRealtime: true,
          maxRetries: 2,
        }),
      );

      expect(result.current.isConnected).toBe(false);

      // Simulate connection
      act(() => {
        mockWebSocket.simulateOpen();
      });

      expect(result.current.isConnected).toBe(true);

      // Simulate disconnection
      act(() => {
        mockWebSocket.simulateClose();
      });

      expect(result.current.isConnected).toBe(false);

      // Should attempt to reconnect
      await waitFor(
        () => {
          expect(WebSocket).toHaveBeenCalledTimes(2);
        },
        { timeout: 6000 },
      );
    });
  });

  describe("Data Loading", () => {
    it("loads billing statistics", async () => {
      const mockStats = {
        totalRevenue: 10000,
        monthlyRecurringRevenue: 2500,
        overdueInvoices: 5,
        collectionRate: 95.5,
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stats: mockStats }),
      });

      const { result } = renderHook(() => useBilling());

      await act(async () => {
        await result.current.loadStats("30d");
      });

      expect(result.current.stats).toEqual(mockStats);
    });

    it("loads filtered invoices", async () => {
      const filteredInvoices = [mockInvoice({ status: "overdue" })];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoices: filteredInvoices }),
      });

      const { result } = renderHook(() => useBilling());

      await act(async () => {
        await result.current.loadInvoices({
          status: "overdue",
          dateFrom: new Date("2024-01-01"),
          limit: 10,
        });
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("status=overdue"),
        expect.any(Object),
      );
      expect(result.current.invoices).toEqual(filteredInvoices);
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useBilling());

      await act(async () => {
        try {
          await result.current.loadInvoices();
        } catch (error) {
          // Error should be handled internally
        }
      });

      expect(result.current.error).toBe("Network error");
      expect(result.current.isLoading).toBe(false);
    });

    it("clears errors when requested", async () => {
      const { result } = renderHook(() => useBilling());

      act(() => {
        result.current.error = "Test error";
      });

      expect(result.current.error).toBe("Test error");

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it("handles WebSocket errors", async () => {
      const { result } = renderHook(() =>
        useBilling({
          websocketEndpoint: "ws://localhost:8080",
          enableRealtime: true,
        }),
      );

      act(() => {
        mockWebSocket.simulateError();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBe("WebSocket connection failed");
    });
  });

  describe("Computed Values", () => {
    it("calculates total outstanding correctly", () => {
      const { result } = renderHook(() => useBilling());

      const invoices = [
        mockInvoice({ status: "sent", amountDue: 100 }),
        mockInvoice({ status: "overdue", amountDue: 200 }),
        mockInvoice({ status: "paid", amountDue: 0 }),
      ];

      act(() => {
        result.current.invoices = invoices;
      });

      expect(result.current.totalOutstanding).toBe(300);
    });

    it("filters overdue invoices", () => {
      const { result } = renderHook(() => useBilling());

      const invoices = [
        mockInvoice({ status: "sent" }),
        mockInvoice({ status: "overdue" }),
        mockInvoice({ status: "paid" }),
      ];

      act(() => {
        result.current.invoices = invoices;
      });

      expect(result.current.overdueInvoices).toHaveLength(1);
      expect(result.current.overdueInvoices[0].status).toBe("overdue");
    });

    it("filters failed payments", () => {
      const { result } = renderHook(() => useBilling());

      const payments = [
        mockPayment({ status: "completed" }),
        mockPayment({ status: "failed" }),
        mockPayment({ status: "pending" }),
      ];

      act(() => {
        result.current.payments = payments;
      });

      expect(result.current.failedPayments).toHaveLength(1);
      expect(result.current.failedPayments[0].status).toBe("failed");
    });
  });

  describe("Performance", () => {
    it("handles large datasets efficiently", async () => {
      const manyInvoices = Array.from({ length: 10000 }, () => mockInvoice());

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoices: manyInvoices }),
      });

      const startTime = performance.now();
      const { result } = renderHook(() => useBilling());

      await act(async () => {
        await result.current.loadInvoices();
      });

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.current.invoices).toHaveLength(10000);
    });

    it("debounces rapid WebSocket updates", async () => {
      const { result } = renderHook(() =>
        useBilling({
          websocketEndpoint: "ws://localhost:8080",
          enableRealtime: true,
        }),
      );

      act(() => {
        mockWebSocket.simulateOpen();
      });

      // Send many rapid updates
      const startTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        act(() => {
          mockWebSocket.simulateMessage({
            type: "stats_update",
            stats: { totalRevenue: i },
          });
        });
      }
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(500);
      expect(result.current.stats?.totalRevenue).toBe(999);
    });
  });

  describe("Configuration Options", () => {
    it("uses custom API endpoint", async () => {
      renderHook(() =>
        useBilling({
          apiEndpoint: "/custom/billing",
        }),
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/custom/billing"),
        expect.any(Object),
      );
    });

    it("includes authentication headers", async () => {
      renderHook(() =>
        useBilling({
          apiKey: "test-api-key",
          tenantId: "tenant-123",
          resellerId: "reseller-456",
        }),
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
            "X-Tenant-ID": "tenant-123",
            "X-Reseller-ID": "reseller-456",
          }),
        }),
      );
    });

    it("disables real-time features when requested", () => {
      renderHook(() =>
        useBilling({
          websocketEndpoint: "ws://localhost:8080",
          enableRealtime: false,
        }),
      );

      expect(WebSocket).not.toHaveBeenCalled();
    });
  });
});
