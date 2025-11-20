/**
 * Unit Tests for useInvoiceActions hook
 * Tests invoice action mutations with Jest mocks for fast, reliable unit testing
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies BEFORE importing the hooks
const mockToast = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

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

import { useInvoiceActions, type CreditNote } from "../useInvoiceActions";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// ============================================================================
// Test Utilities
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe("useInvoiceActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendInvoiceEmail", () => {
    it("should send invoice email successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, message: "Email sent" },
      });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isSending).toBe(false);

      let response: any;
      await act(async () => {
        response = await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      expect(response).toEqual({ success: true, message: "Email sent" });

      await waitFor(() => {
        expect(result.current.sendInvoiceEmail.isSuccess).toBe(true);
        expect(result.current.sendInvoiceEmail.error).toBeNull();
      });
    });

    it("should call correct API endpoint", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/inv-123/send", {});
    });

    it("should send invoice with custom email", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

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
    });

    it("should call success toast", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Invoice Sent",
        description: "Invoice has been sent successfully.",
      });
    });

    it("should include custom email in success toast", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-123",
          email: "custom@example.com",
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Invoice Sent",
        description: "Invoice has been sent successfully to custom@example.com.",
      });
    });

    it("should handle error with detail", async () => {
      const error = {
        response: {
          data: { detail: "Email service unavailable" },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.sendInvoiceEmail.mutateAsync({
            invoiceId: "inv-123",
          });
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.sendInvoiceEmail.isError).toBe(true);
        expect(result.current.sendInvoiceEmail.error).toBeTruthy();
      });
    });

    it("should call error toast with detail", async () => {
      const error = {
        response: {
          data: { detail: "Email service unavailable" },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.sendInvoiceEmail.mutateAsync({
            invoiceId: "inv-123",
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Failed to Send Invoice",
        description: "Email service unavailable",
        variant: "destructive",
      });
    });

    it("should call error toast with fallback message", async () => {
      const error = new Error("Network error");

      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.sendInvoiceEmail.mutateAsync({
            invoiceId: "inv-123",
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Failed to Send Invoice",
        description: "Unable to send invoice. Please try again.",
        variant: "destructive",
      });
    });

    it("should call logger on error", async () => {
      const error = new Error("API error");
      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.sendInvoiceEmail.mutateAsync({
            invoiceId: "inv-123",
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(logger.error).toHaveBeenCalledWith("Failed to send invoice email", error);
    });

    it("should track loading state", async () => {
      let resolvePromise: any;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (apiClient.post as jest.Mock).mockReturnValueOnce(promise);

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

      act(() => {
        resolvePromise({ data: {} });
      });

      await waitFor(() => expect(result.current.isSending).toBe(false));
    });
  });

  describe("voidInvoice", () => {
    it("should void invoice successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
      });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isVoiding).toBe(false);

      await act(async () => {
        await result.current.voidInvoice.mutateAsync({
          invoiceId: "inv-123",
          reason: "Customer requested cancellation",
        });
      });

      await waitFor(() => {
        expect(result.current.voidInvoice.isSuccess).toBe(true);
        expect(result.current.voidInvoice.error).toBeNull();
      });
    });

    it("should call correct API endpoint with payload", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.voidInvoice.mutateAsync({
          invoiceId: "inv-123",
          reason: "Duplicate invoice",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/inv-123/void", {
        reason: "Duplicate invoice",
      });
    });

    it("should call success toast", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.voidInvoice.mutateAsync({
          invoiceId: "inv-123",
          reason: "Test",
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Invoice Voided",
        description: "Invoice has been voided successfully.",
      });
    });

    it("should call error toast with destructive variant", async () => {
      const error = {
        response: {
          data: { detail: "Cannot void paid invoice" },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.voidInvoice.mutateAsync({
            invoiceId: "inv-123",
            reason: "Test",
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Failed to Void Invoice",
        description: "Cannot void paid invoice",
        variant: "destructive",
      });
    });

    it("should call logger on error", async () => {
      const error = new Error("API error");
      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.voidInvoice.mutateAsync({
            invoiceId: "inv-123",
            reason: "Test",
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(logger.error).toHaveBeenCalledWith("Failed to void invoice", error);
    });
  });

  describe("sendPaymentReminder", () => {
    it("should send payment reminder successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
      });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isSendingReminder).toBe(false);

      await act(async () => {
        await result.current.sendPaymentReminder.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      await waitFor(() => {
        expect(result.current.sendPaymentReminder.isSuccess).toBe(true);
      });
    });

    it("should call correct API endpoint", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendPaymentReminder.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/inv-123/remind", {});
    });

    it("should send reminder with custom message", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendPaymentReminder.mutateAsync({
          invoiceId: "inv-123",
          message: "Your payment is overdue",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/inv-123/remind", {
        message: "Your payment is overdue",
      });
    });

    it("should call success toast", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendPaymentReminder.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Reminder Sent",
        description: "Payment reminder has been sent successfully.",
      });
    });

    it("should call error toast", async () => {
      const error = {
        response: {
          data: { detail: "Notification service unavailable" },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.sendPaymentReminder.mutateAsync({
            invoiceId: "inv-123",
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Failed to Send Reminder",
        description: "Notification service unavailable",
        variant: "destructive",
      });
    });

    it("should call logger on error", async () => {
      const error = new Error("API error");
      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.sendPaymentReminder.mutateAsync({
            invoiceId: "inv-123",
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(logger.error).toHaveBeenCalledWith("Failed to send payment reminder", error);
    });
  });

  describe("createCreditNote", () => {
    it("should create credit note successfully", async () => {
      const mockCreditNote: CreditNote = {
        id: "cn-123",
        credit_note_number: "CN-2024-001",
        invoice_id: "inv-123",
        amount: 50.0,
        reason: "Partial refund",
        status: "applied",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: mockCreditNote,
      });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isCreatingCreditNote).toBe(false);

      let response: any;
      await act(async () => {
        response = await result.current.createCreditNote.mutateAsync({
          invoice_id: "inv-123",
          amount: 50.0,
          reason: "Partial refund",
        });
      });

      expect(response).toEqual(mockCreditNote);

      await waitFor(() => {
        expect(result.current.createCreditNote.isSuccess).toBe(true);
      });
    });

    it("should call correct API endpoint with payload", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: {
          id: "cn-123",
          credit_note_number: "CN-001",
          invoice_id: "inv-123",
          amount: 100,
          reason: "Refund",
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
          invoice_id: "inv-123",
          amount: 100.0,
          reason: "Service not delivered",
          notes: "Customer complaint",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/credit-notes", {
        invoice_id: "inv-123",
        amount: 100.0,
        reason: "Service not delivered",
        notes: "Customer complaint",
      });
    });

    it("should create credit note with line items", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: {
          id: "cn-123",
          credit_note_number: "CN-001",
          invoice_id: "inv-123",
          amount: 100,
          reason: "Refund",
          status: "applied",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      const lineItems = [
        {
          description: "Refund for service X",
          quantity: 1,
          unit_price: 100.0,
          total_price: 100.0,
        },
      ];

      await act(async () => {
        await result.current.createCreditNote.mutateAsync({
          invoice_id: "inv-123",
          amount: 100.0,
          reason: "Service not delivered",
          line_items: lineItems,
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/credit-notes", {
        invoice_id: "inv-123",
        amount: 100.0,
        reason: "Service not delivered",
        line_items: lineItems,
      });
    });

    it("should call success toast with credit note number", async () => {
      const mockCreditNote: CreditNote = {
        id: "cn-123",
        credit_note_number: "CN-2024-001",
        invoice_id: "inv-123",
        amount: 50.0,
        reason: "Partial refund",
        status: "applied",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: mockCreditNote,
      });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.createCreditNote.mutateAsync({
          invoice_id: "inv-123",
          amount: 50.0,
          reason: "Partial refund",
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Credit Note Created",
        description: "Credit note CN-2024-001 has been created successfully.",
      });
    });

    it("should call error toast", async () => {
      const error = {
        response: {
          data: { detail: "Invalid amount" },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.createCreditNote.mutateAsync({
            invoice_id: "inv-123",
            amount: -50.0,
            reason: "Test",
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Failed to Create Credit Note",
        description: "Invalid amount",
        variant: "destructive",
      });
    });

    it("should call logger on error", async () => {
      const error = new Error("API error");
      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.createCreditNote.mutateAsync({
            invoice_id: "inv-123",
            amount: 50.0,
            reason: "Test",
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(logger.error).toHaveBeenCalledWith("Failed to create credit note", error);
    });
  });

  describe("Loading States", () => {
    it("should provide individual loading states", () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isSending).toBe(false);
      expect(result.current.isVoiding).toBe(false);
      expect(result.current.isSendingReminder).toBe(false);
      expect(result.current.isCreatingCreditNote).toBe(false);
    });

    it("should track combined loading state", () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("should set combined loading during any mutation", async () => {
      let resolvePromise: any;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (apiClient.post as jest.Mock).mockReturnValueOnce(promise);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.sendInvoiceEmail.mutate({
          invoiceId: "inv-123",
        });
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));

      act(() => {
        resolvePromise({ data: {} });
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });
  });

  describe("Mutation States", () => {
    it("should be in idle state initially", () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.sendInvoiceEmail.isIdle).toBe(true);
      expect(result.current.sendInvoiceEmail.isPending).toBe(false);
      expect(result.current.sendInvoiceEmail.isSuccess).toBe(false);
      expect(result.current.sendInvoiceEmail.isError).toBe(false);
    });

    it("should transition to pending state during mutation", async () => {
      let resolvePromise: any;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (apiClient.post as jest.Mock).mockReturnValueOnce(promise);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.sendInvoiceEmail.mutate({
          invoiceId: "inv-123",
        });
      });

      await waitFor(() => expect(result.current.sendInvoiceEmail.isPending).toBe(true));

      act(() => {
        resolvePromise({ data: {} });
      });

      await waitFor(() => expect(result.current.sendInvoiceEmail.isPending).toBe(false));
    });

    it("should transition to success state after successful mutation", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      await waitFor(() => {
        expect(result.current.sendInvoiceEmail.isSuccess).toBe(true);
        expect(result.current.sendInvoiceEmail.isError).toBe(false);
      });
    });

    it("should transition to error state after failed mutation", async () => {
      (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error("API error"));

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.sendInvoiceEmail.mutateAsync({
            invoiceId: "inv-123",
          });
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.sendInvoiceEmail.isError).toBe(true);
        expect(result.current.sendInvoiceEmail.isSuccess).toBe(false);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing optional email field", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-123",
          // No email provided
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/inv-123/send", {});
    });

    it("should handle missing optional message field", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendPaymentReminder.mutateAsync({
          invoiceId: "inv-123",
          // No message provided
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/invoices/inv-123/remind", {});
    });

    it("should handle missing optional line_items and notes", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: {
          id: "cn-123",
          credit_note_number: "CN-001",
          invoice_id: "inv-123",
          amount: 50,
          reason: "Refund",
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
          invoice_id: "inv-123",
          amount: 50.0,
          reason: "Refund",
          // No line_items or notes
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/credit-notes", {
        invoice_id: "inv-123",
        amount: 50.0,
        reason: "Refund",
      });
    });

    it("should handle error without response object", async () => {
      const error = new Error("Network timeout");

      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.sendInvoiceEmail.mutateAsync({
            invoiceId: "inv-123",
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Failed to Send Invoice",
        description: "Unable to send invoice. Please try again.",
        variant: "destructive",
      });
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle sequential invoice actions", async () => {
      (apiClient.post as jest.Mock)
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      // Send invoice
      await act(async () => {
        await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      await waitFor(() => {
        expect(result.current.sendInvoiceEmail.isSuccess).toBe(true);
      });

      // Send reminder
      await act(async () => {
        await result.current.sendPaymentReminder.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      await waitFor(() => {
        expect(result.current.sendPaymentReminder.isSuccess).toBe(true);
      });

      // Void invoice
      await act(async () => {
        await result.current.voidInvoice.mutateAsync({
          invoiceId: "inv-123",
          reason: "Customer dispute",
        });
      });

      await waitFor(() => {
        expect(result.current.voidInvoice.isSuccess).toBe(true);
      });
    });

    it("should handle partial failure in sequential actions", async () => {
      (apiClient.post as jest.Mock)
        .mockResolvedValueOnce({ data: {} })
        .mockRejectedValueOnce(new Error("API error"));

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createWrapper(),
      });

      // Success
      await act(async () => {
        await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      await waitFor(() => {
        expect(result.current.sendInvoiceEmail.isSuccess).toBe(true);
      });

      // Failure
      await act(async () => {
        try {
          await result.current.voidInvoice.mutateAsync({
            invoiceId: "inv-123",
            reason: "Test",
          });
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.voidInvoice.isError).toBe(true);
        expect(result.current.sendInvoiceEmail.isSuccess).toBe(true); // First action still successful
      });
    });
  });
});
