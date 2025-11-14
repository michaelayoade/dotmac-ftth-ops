/**
 * MSW-powered tests for useInvoiceActions
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useInvoiceActions } from "../useInvoiceActions";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetInvoiceActionsStorage,
  resetCreditNotesStorage,
  createMockCreditNote,
  seedCreditNotesData,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";

// Mock toast
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe("useInvoiceActions (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetInvoiceActionsStorage();
    resetCreditNotesStorage();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("sendInvoiceEmail", () => {
    it("should send invoice email successfully", async () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isSending).toBe(false);

      let responseData: any;
      await act(async () => {
        responseData = await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      expect(responseData).toEqual({
        success: true,
        message: "Invoice sent successfully",
        email: undefined,
      });
      expect(result.current.sendInvoiceEmail.error).toBeNull();
    });

    it("should send invoice email with custom recipient", async () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-123",
          email: "custom@example.com",
        });
      });

      expect(result.current.sendInvoiceEmail.data?.email).toBe(
        "custom@example.com"
      );
    });

    it("should handle send invoice error", async () => {
      makeApiEndpointFail(
        "post",
        "/billing/invoices/inv-123/send",
        "Email service unavailable"
      );

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
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

      expect(result.current.sendInvoiceEmail.error).toBeTruthy();
    });

    it("should track loading state while sending", async () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isSending).toBe(false);

      act(() => {
        result.current.sendInvoiceEmail.mutate({
          invoiceId: "inv-123",
        });
      });

      // Will be pending briefly, then complete
      await waitFor(() =>
        expect(result.current.sendInvoiceEmail.isSuccess).toBe(true)
      );
      expect(result.current.isSending).toBe(false);
    });
  });

  describe("voidInvoice", () => {
    it("should void invoice successfully", async () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isVoiding).toBe(false);

      let responseData: any;
      await act(async () => {
        responseData = await result.current.voidInvoice.mutateAsync({
          invoiceId: "inv-123",
          reason: "Customer requested cancellation",
        });
      });

      expect(responseData).toEqual({
        success: true,
        message: "Invoice voided successfully",
        reason: "Customer requested cancellation",
      });
      expect(result.current.voidInvoice.error).toBeNull();
    });

    it("should handle void invoice error", async () => {
      makeApiEndpointFail(
        "post",
        "/billing/invoices/inv-123/void",
        "Invoice already paid",
        400
      );

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
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

      expect(result.current.voidInvoice.error).toBeTruthy();
    });
  });

  describe("sendPaymentReminder", () => {
    it("should send payment reminder successfully", async () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isSendingReminder).toBe(false);

      await act(async () => {
        await result.current.sendPaymentReminder.mutateAsync({
          invoiceId: "inv-123",
        });
      });

      expect(result.current.sendPaymentReminder.data).toEqual({
        success: true,
        message: "Payment reminder sent successfully",
        message_override: undefined,
      });
      expect(result.current.sendPaymentReminder.error).toBeNull();
    });

    it("should send payment reminder with custom message", async () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        await result.current.sendPaymentReminder.mutateAsync({
          invoiceId: "inv-123",
          message: "Your payment is overdue. Please pay immediately.",
        });
      });

      expect(result.current.sendPaymentReminder.data?.message_override).toBe(
        "Your payment is overdue. Please pay immediately."
      );
    });

    it("should handle send reminder error", async () => {
      makeApiEndpointFail(
        "post",
        "/billing/invoices/inv-123/remind",
        "Notification service unavailable"
      );

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
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

      expect(result.current.sendPaymentReminder.error).toBeTruthy();
    });
  });

  describe("createCreditNote", () => {
    it("should create credit note successfully", async () => {
      // Seed a mock credit note that will be returned
      const mockNote = createMockCreditNote({
        credit_note_id: "cn-new",
        credit_note_number: "CN-NEW-001",
        invoice_id: "inv-123",
        total_amount: 5000,
        status: "applied",
      });

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isCreatingCreditNote).toBe(false);

      await act(async () => {
        await result.current.createCreditNote.mutateAsync({
          invoice_id: "inv-123",
          amount: 50.0,
          reason: "Partial refund requested",
          notes: "Customer was overcharged",
        });
      });

      expect(result.current.createCreditNote.error).toBeNull();
      expect(result.current.isCreatingCreditNote).toBe(false);
    });

    it("should create credit note with line items", async () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        await result.current.createCreditNote.mutateAsync({
          invoice_id: "inv-123",
          amount: 100.0,
          reason: "Service not delivered",
          line_items: [
            {
              description: "Refund for service X",
              quantity: 1,
              unit_price: 100.0,
            },
          ],
        });
      });

      expect(result.current.createCreditNote.error).toBeNull();
    });

    it("should handle create credit note error", async () => {
      makeApiEndpointFail(
        "post",
        "/billing/credit-notes",
        "Invalid amount",
        400
      );

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.createCreditNote.mutateAsync({
            invoice_id: "inv-123",
            amount: -50.0, // Invalid negative amount
            reason: "Test",
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(result.current.createCreditNote.error).toBeTruthy();
    });
  });

  describe("Combined loading states", () => {
    it("should provide individual loading states", () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isSending).toBe(false);
      expect(result.current.isVoiding).toBe(false);
      expect(result.current.isSendingReminder).toBe(false);
      expect(result.current.isCreatingCreditNote).toBe(false);
    });

    it("should track combined loading state", async () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.sendInvoiceEmail.mutate({
          invoiceId: "inv-123",
        });
      });

      // Will be loading briefly, then complete
      await waitFor(() =>
        expect(result.current.sendInvoiceEmail.isSuccess).toBe(true)
      );
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle sequential invoice actions", async () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // First, send invoice email
      await act(async () => {
        await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-123",
          email: "customer@example.com",
        });
      });

      await waitFor(() =>
        expect(result.current.sendInvoiceEmail.isSuccess).toBe(true)
      );

      // Then, send payment reminder
      await act(async () => {
        await result.current.sendPaymentReminder.mutateAsync({
          invoiceId: "inv-123",
          message: "Payment is overdue",
        });
      });

      await waitFor(() =>
        expect(result.current.sendPaymentReminder.isSuccess).toBe(true)
      );

      // Finally, void invoice if needed
      await act(async () => {
        await result.current.voidInvoice.mutateAsync({
          invoiceId: "inv-123",
          reason: "Customer dispute",
        });
      });

      await waitFor(() =>
        expect(result.current.voidInvoice.isSuccess).toBe(true)
      );
    });

    it("should handle multiple invoice actions independently", async () => {
      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Send emails for different invoices
      await act(async () => {
        await Promise.all([
          result.current.sendInvoiceEmail.mutateAsync({
            invoiceId: "inv-001",
          }),
          result.current.sendPaymentReminder.mutateAsync({
            invoiceId: "inv-002",
          }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.sendInvoiceEmail.isSuccess).toBe(true);
        expect(result.current.sendPaymentReminder.isSuccess).toBe(true);
      });
    });

    it("should handle partial failure in multiple actions", async () => {
      makeApiEndpointFail(
        "post",
        "/billing/invoices/inv-fail/void",
        "Cannot void paid invoice",
        400
      );

      const { result } = renderHook(() => useInvoiceActions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Success case
      await act(async () => {
        await result.current.sendInvoiceEmail.mutateAsync({
          invoiceId: "inv-ok",
        });
      });

      await waitFor(() =>
        expect(result.current.sendInvoiceEmail.isSuccess).toBe(true)
      );

      // Failure case
      await act(async () => {
        try {
          await result.current.voidInvoice.mutateAsync({
            invoiceId: "inv-fail",
            reason: "Test",
          });
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() =>
        expect(result.current.voidInvoice.error).toBeTruthy()
      );
      // sendInvoiceEmail should still be successful
      expect(result.current.sendInvoiceEmail.isSuccess).toBe(true);
    });
  });
});
