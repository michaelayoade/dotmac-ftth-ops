/**
 * Tests for useInvoiceActions hook
 * Tests invoice actions: send email, void, send reminder, create credit note
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useInvoiceActions } from "../useInvoiceActions";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { useToast } from "@dotmac/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("useInvoiceActions", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendInvoiceEmail", () => {
    it("should send invoice email successfully", async () => {
      const mockResponse = { success: true, message: "Invoice sent" };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/inv-123/send", {});
      expect(mockToast).toHaveBeenCalledWith({
        title: "Invoice Sent",
        description: "Invoice has been sent successfully.",
      });
    });

    it("should send invoice email with custom email override", async () => {
      const mockResponse = { success: true, message: "Invoice sent" };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-123",
          email: "custom@example.com",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/inv-123/send", {
        email: "custom@example.com",
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: "Invoice Sent",
        description: "Invoice has been sent successfully to custom@example.com.",
      });
    });

    it("should handle send invoice email error", async () => {
      const mockError = {
        response: {
          data: {
            detail: "Email service unavailable",
          },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.sendInvoiceEmail.mutateAsync({
            invoiceId: "inv-123",
          });
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Failed to send invoice email", mockError);
        expect(mockToast).toHaveBeenCalledWith({
          title: "Failed to Send Invoice",
          description: "Email service unavailable",
          variant: "destructive",
        });
      });
    });

    it("should handle send invoice email error without detail", async () => {
      const mockError = new Error("Network error");

      (apiClient.post as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.sendInvoiceEmail.mutateAsync({
            invoiceId: "inv-123",
          });
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Failed to Send Invoice",
          description: "Unable to send invoice. Please try again.",
          variant: "destructive",
        });
      });
    });

    it("should set isSending state correctly", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100)),
      );

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isSending).toBe(false);

      act(() => {
        result.current.sendInvoiceEmail.mutate({
          invoiceId: "inv-123",
        });
      });

      await waitFor(() => expect(result.current.isSending).toBe(true));
      await waitFor(() => expect(result.current.isSending).toBe(false));
    });
  });

  describe("voidInvoice", () => {
    it("should void invoice successfully", async () => {
      const mockResponse = { success: true, message: "Invoice voided" };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.voidInvoice.mutateAsync({
          invoiceId: "inv-123",
          reason: "Customer requested cancellation",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/inv-123/void", {
        reason: "Customer requested cancellation",
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: "Invoice Voided",
        description: "Invoice has been voided successfully.",
      });
    });

    it("should handle void invoice error", async () => {
      const mockError = {
        response: {
          data: {
            detail: "Invoice already paid",
          },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.voidInvoice.mutateAsync({
            invoiceId: "inv-123",
            reason: "Test reason",
          });
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Failed to void invoice", mockError);
        expect(mockToast).toHaveBeenCalledWith({
          title: "Failed to Void Invoice",
          description: "Invoice already paid",
          variant: "destructive",
        });
      });
    });

    it("should handle void invoice error without detail", async () => {
      const mockError = new Error("Network error");

      (apiClient.post as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.voidInvoice.mutateAsync({
            invoiceId: "inv-123",
            reason: "Test reason",
          });
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Failed to Void Invoice",
          description: "Unable to void invoice. Please try again.",
          variant: "destructive",
        });
      });
    });

    it("should set isVoiding state correctly", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100)),
      );

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isVoiding).toBe(false);

      act(() => {
        result.current.voidInvoice.mutate({
          invoiceId: "inv-123",
          reason: "Test reason",
        });
      });

      await waitFor(() => expect(result.current.isVoiding).toBe(true));
      await waitFor(() => expect(result.current.isVoiding).toBe(false));
    });
  });

  describe("sendPaymentReminder", () => {
    it("should send payment reminder successfully", async () => {
      const mockResponse = { success: true, message: "Reminder sent" };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendPaymentReminder.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/inv-123/remind", {});
      expect(mockToast).toHaveBeenCalledWith({
        title: "Reminder Sent",
        description: "Payment reminder has been sent successfully.",
      });
    });

    it("should send payment reminder with custom message", async () => {
      const mockResponse = { success: true, message: "Reminder sent" };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendPaymentReminder.mutateAsync({
          invoiceId: "inv-123",
          message: "Your payment is overdue. Please pay immediately.",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/inv-123/remind", {
        message: "Your payment is overdue. Please pay immediately.",
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: "Reminder Sent",
        description: "Payment reminder has been sent successfully.",
      });
    });

    it("should handle send reminder error", async () => {
      const mockError = {
        response: {
          data: {
            detail: "Customer email not found",
          },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.sendPaymentReminder.mutateAsync({
            invoiceId: "inv-123",
          });
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Failed to send payment reminder", mockError);
        expect(mockToast).toHaveBeenCalledWith({
          title: "Failed to Send Reminder",
          description: "Customer email not found",
          variant: "destructive",
        });
      });
    });

    it("should handle send reminder error without detail", async () => {
      const mockError = new Error("Network error");

      (apiClient.post as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.sendPaymentReminder.mutateAsync({
            invoiceId: "inv-123",
          });
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Failed to Send Reminder",
          description: "Unable to send payment reminder. Please try again.",
          variant: "destructive",
        });
      });
    });

    it("should set isSendingReminder state correctly", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100)),
      );

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isSendingReminder).toBe(false);

      act(() => {
        result.current.sendPaymentReminder.mutate({
          invoiceId: "inv-123",
        });
      });

      await waitFor(() => expect(result.current.isSendingReminder).toBe(true));
      await waitFor(() => expect(result.current.isSendingReminder).toBe(false));
    });
  });

  describe("createCreditNote", () => {
    it("should create credit note successfully", async () => {
      const mockCreditNote = {
        id: "cn-123",
        credit_note_number: "CN-2024-001",
        invoice_id: "inv-123",
        amount: 100,
        reason: "Product return",
        status: "applied",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockCreditNote });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      let createdNote;
      await act(async () => {
        createdNote = await result.current.createCreditNote.mutateAsync({
          invoice_id: "inv-123",
          amount: 100,
          reason: "Product return",
        });
      });

      expect(createdNote).toEqual(mockCreditNote);
      expect(apiClient.post).toHaveBeenCalledWith("/billing/credit-notes", {
        invoice_id: "inv-123",
        amount: 100,
        reason: "Product return",
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: "Credit Note Created",
        description: "Credit note CN-2024-001 has been created successfully.",
      });
    });

    it("should create credit note with line items", async () => {
      const mockCreditNote = {
        id: "cn-123",
        credit_note_number: "CN-2024-002",
        invoice_id: "inv-123",
        amount: 250,
        reason: "Service cancellation",
        status: "applied",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockCreditNote });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      const lineItems = [
        {
          description: "Service fee refund",
          quantity: 2,
          unit_price: 100,
          total_price: 200,
        },
        {
          description: "Setup fee refund",
          quantity: 1,
          unit_price: 50,
          total_price: 50,
        },
      ];

      await act(async () => {
        await result.current.createCreditNote.mutateAsync({
          invoice_id: "inv-123",
          amount: 250,
          reason: "Service cancellation",
          line_items: lineItems,
          notes: "Customer requested full refund",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/credit-notes", {
        invoice_id: "inv-123",
        amount: 250,
        reason: "Service cancellation",
        line_items: lineItems,
        notes: "Customer requested full refund",
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: "Credit Note Created",
        description: "Credit note CN-2024-002 has been created successfully.",
      });
    });

    it("should handle create credit note error", async () => {
      const mockError = {
        response: {
          data: {
            detail: "Amount exceeds invoice total",
          },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.createCreditNote.mutateAsync({
            invoice_id: "inv-123",
            amount: 1000,
            reason: "Test reason",
          });
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Failed to create credit note", mockError);
        expect(mockToast).toHaveBeenCalledWith({
          title: "Failed to Create Credit Note",
          description: "Amount exceeds invoice total",
          variant: "destructive",
        });
      });
    });

    it("should handle create credit note error without detail", async () => {
      const mockError = new Error("Network error");

      (apiClient.post as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.createCreditNote.mutateAsync({
            invoice_id: "inv-123",
            amount: 100,
            reason: "Test reason",
          });
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Failed to Create Credit Note",
          description: "Unable to create credit note. Please try again.",
          variant: "destructive",
        });
      });
    });

    it("should set isCreatingCreditNote state correctly", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    id: "cn-123",
                    credit_note_number: "CN-2024-001",
                    invoice_id: "inv-123",
                    amount: 100,
                    reason: "Test",
                    status: "applied",
                    created_at: "2024-01-01T00:00:00Z",
                    updated_at: "2024-01-01T00:00:00Z",
                  },
                }),
              100,
            ),
          ),
      );

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isCreatingCreditNote).toBe(false);

      act(() => {
        result.current.createCreditNote.mutate({
          invoice_id: "inv-123",
          amount: 100,
          reason: "Test reason",
        });
      });

      await waitFor(() => expect(result.current.isCreatingCreditNote).toBe(true));
      await waitFor(() => expect(result.current.isCreatingCreditNote).toBe(false));
    });
  });

  describe("combined loading state", () => {
    it("should show isLoading when sendInvoiceEmail is pending", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100)),
      );

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.sendInvoiceEmail.mutate({
          invoiceId: "inv-123",
        });
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it("should show isLoading when voidInvoice is pending", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100)),
      );

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.voidInvoice.mutate({
          invoiceId: "inv-123",
          reason: "Test",
        });
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it("should show isLoading when sendPaymentReminder is pending", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100)),
      );

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.sendPaymentReminder.mutate({
          invoiceId: "inv-123",
        });
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it("should show isLoading when createCreditNote is pending", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    id: "cn-123",
                    credit_note_number: "CN-2024-001",
                    invoice_id: "inv-123",
                    amount: 100,
                    reason: "Test",
                    status: "applied",
                    created_at: "2024-01-01T00:00:00Z",
                    updated_at: "2024-01-01T00:00:00Z",
                  },
                }),
              100,
            ),
          ),
      );

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.createCreditNote.mutate({
          invoice_id: "inv-123",
          amount: 100,
          reason: "Test",
        });
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it("should be false when no operations are pending", () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSending).toBe(false);
      expect(result.current.isVoiding).toBe(false);
      expect(result.current.isSendingReminder).toBe(false);
      expect(result.current.isCreatingCreditNote).toBe(false);
    });
  });

  describe("mutation objects", () => {
    it("should expose all mutation objects", () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.sendInvoiceEmail).toBeDefined();
      expect(result.current.voidInvoice).toBeDefined();
      expect(result.current.sendPaymentReminder).toBeDefined();
      expect(result.current.createCreditNote).toBeDefined();

      expect(typeof result.current.sendInvoiceEmail.mutate).toBe("function");
      expect(typeof result.current.voidInvoice.mutate).toBe("function");
      expect(typeof result.current.sendPaymentReminder.mutate).toBe("function");
      expect(typeof result.current.createCreditNote.mutate).toBe("function");
    });
  });

  describe("API endpoints", () => {
    it("should call correct endpoint for sendInvoiceEmail", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "test-invoice-id",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/test-invoice-id/send", {});
    });

    it("should call correct endpoint for voidInvoice", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.voidInvoice.mutateAsync({
          invoiceId: "test-invoice-id",
          reason: "Test reason",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/test-invoice-id/void", {
        reason: "Test reason",
      });
    });

    it("should call correct endpoint for sendPaymentReminder", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendPaymentReminder.mutateAsync({
          invoiceId: "test-invoice-id",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/test-invoice-id/remind", {});
    });

    it("should call correct endpoint for createCreditNote", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {
          id: "cn-123",
          credit_note_number: "CN-2024-001",
          invoice_id: "inv-123",
          amount: 100,
          reason: "Test",
          status: "applied",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.createCreditNote.mutateAsync({
          invoice_id: "test-invoice-id",
          amount: 100,
          reason: "Test reason",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/credit-notes", {
        invoice_id: "test-invoice-id",
        amount: 100,
        reason: "Test reason",
      });
    });
  });
});
