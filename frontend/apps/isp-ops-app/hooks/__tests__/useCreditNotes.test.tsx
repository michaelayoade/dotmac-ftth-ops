/**
 * Unit Tests for useCreditNotes hook
 * Tests the useCreditNotes hook with Jest mocks for fast, reliable unit testing
 */

// Mock AppConfigContext
jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: jest.fn(),
}));

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreditNotes } from "../useCreditNotes";
import { useAppConfig } from "@/providers/AppConfigContext";
import type { CreditNoteSummary } from "../useCreditNotes";
import React from "react";

// ============================================
// Test Utilities
// ============================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ============================================
// Mock Data
// ============================================

const mockApiConfig = {
  baseUrl: "http://localhost:8000",
  prefix: "/api/v1",
  buildUrl: (path: string) => `http://localhost:8000/api/v1${path}`,
};

function createMockApiCreditNote(overrides: Record<string, any> = {}) {
  return {
    credit_note_id: "cn-123",
    credit_note_number: "CN-001",
    customer_id: "cust-456",
    invoice_id: "inv-789",
    issue_date: "2025-01-15",
    currency: "USD",
    total_amount: 10000,
    remaining_credit_amount: 5000,
    status: "issued",
    ...overrides,
  };
}

function createMockCreditNoteSummary(
  overrides: Partial<CreditNoteSummary> = {},
): CreditNoteSummary {
  return {
    id: "cn-123",
    number: "CN-001",
    customerId: "cust-456",
    invoiceId: "inv-789",
    issuedAt: "2025-01-15",
    currency: "USD",
    totalAmountMinor: 10000,
    remainingAmountMinor: 5000,
    status: "issued",
    downloadUrl: "/api/v1/billing/credit-notes/cn-123/download",
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe("useCreditNotes", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    (useAppConfig as jest.Mock).mockReturnValue({ api: mockApiConfig });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Basic Functionality", () => {
    it("should fetch credit notes successfully", async () => {
      const mockResponse = {
        credit_notes: [
          createMockApiCreditNote(),
          createMockApiCreditNote({ credit_note_id: "cn-124", credit_note_number: "CN-002" }),
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useCreditNotes(5), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].id).toBe("cn-123");
      expect(result.current.data?.[1].id).toBe("cn-124");
      expect(result.current.error).toBeNull();
    });

    it("should return empty array when no credit notes exist", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.data).toHaveLength(0);
    });

    it("should use default limit of 5", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [] }),
      });

      renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("limit=5");
    });

    it("should respect custom limit parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [] }),
      });

      renderHook(() => useCreditNotes(10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("limit=10");
    });
  });

  describe("API Contract", () => {
    it("should call correct endpoint with limit parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [] }),
      });

      renderHook(() => useCreditNotes(20), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:8000/api/v1/billing/credit-notes?limit=20",
          expect.any(Object),
        );
      });
    });

    it("should include credentials and headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [] }),
      });

      renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          }),
        );
      });
    });

    it("should use buildUrl from AppConfig", async () => {
      const customBuildUrl = jest.fn((path: string) => `https://custom.com${path}`);
      (useAppConfig as jest.Mock).mockReturnValue({
        api: {
          ...mockApiConfig,
          buildUrl: customBuildUrl,
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [] }),
      });

      renderHook(() => useCreditNotes(5), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(customBuildUrl).toHaveBeenCalledWith("/billing/credit-notes?limit=5");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://custom.com/billing/credit-notes?limit=5",
          expect.any(Object),
        );
      });
    });
  });

  describe("Query Configuration", () => {
    it("should use correct query key structure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [] }),
      });

      const { result } = renderHook(() => useCreditNotes(10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query key should be ["credit-notes", limit, baseUrl, prefix]
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should include API config in query key for proper cache invalidation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [] }),
      });

      const { result: result1 } = renderHook(() => useCreditNotes(5), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      // Change API config
      (useAppConfig as jest.Mock).mockReturnValue({
        api: {
          baseUrl: "https://different.com",
          prefix: "/v2",
          buildUrl: (path: string) => `https://different.com/v2${path}`,
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [] }),
      });

      const { result: result2 } = renderHook(() => useCreditNotes(5), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result2.current.isSuccess).toBe(true));

      // Should have made 2 fetch calls (different cache keys)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Data Transformation", () => {
    it("should transform API response to CreditNoteSummary format", async () => {
      const apiNote = createMockApiCreditNote({
        credit_note_id: "cn-test-1",
        credit_note_number: "CN-TEST-001",
        customer_id: "cust-123",
        invoice_id: "inv-456",
        issue_date: "2025-01-15",
        currency: "EUR",
        total_amount: 25000,
        remaining_credit_amount: 10000,
        status: "voided",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const creditNote = result.current.data?.[0];
      expect(creditNote).toEqual({
        id: "cn-test-1",
        number: "CN-TEST-001",
        customerId: "cust-123",
        invoiceId: "inv-456",
        issuedAt: "2025-01-15",
        currency: "EUR",
        totalAmountMinor: 25000,
        remainingAmountMinor: 10000,
        status: "voided",
        downloadUrl: "/api/v1/billing/credit-notes/cn-test-1/download",
      });
    });

    it("should use default currency USD when not provided", async () => {
      const apiNote = createMockApiCreditNote({ currency: undefined });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].currency).toBe("USD");
    });

    it("should use default status 'draft' when not provided", async () => {
      const apiNote = createMockApiCreditNote({ status: undefined });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].status).toBe("draft");
    });

    it("should convert status to string", async () => {
      const apiNote = createMockApiCreditNote({ status: 123 });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].status).toBe("123");
    });

    it("should convert amounts to numbers", async () => {
      const apiNote = createMockApiCreditNote({
        total_amount: "15000",
        remaining_credit_amount: "7500",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].totalAmountMinor).toBe(15000);
      expect(result.current.data?.[0].remainingAmountMinor).toBe(7500);
    });

    it("should use 0 for amounts when not provided", async () => {
      const apiNote = createMockApiCreditNote({
        total_amount: undefined,
        remaining_credit_amount: undefined,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].totalAmountMinor).toBe(0);
      expect(result.current.data?.[0].remainingAmountMinor).toBe(0);
    });

    it("should construct downloadUrl from credit_note_id", async () => {
      const apiNote = createMockApiCreditNote({ credit_note_id: "cn-download-test" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].downloadUrl).toBe(
        "/api/v1/billing/credit-notes/cn-download-test/download",
      );
    });

    it("should use '#' for downloadUrl when id is missing", async () => {
      const apiNote = createMockApiCreditNote({ credit_note_id: undefined });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].downloadUrl).toBe("#");
    });

    it("should fallback number to id when credit_note_number is missing", async () => {
      const apiNote = createMockApiCreditNote({
        credit_note_id: "cn-fallback",
        credit_note_number: undefined,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].number).toBe("cn-fallback");
    });

    it("should use empty string for number when both id and number are missing", async () => {
      const apiNote = createMockApiCreditNote({
        credit_note_id: undefined,
        credit_note_number: undefined,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].number).toBe("");
    });

    it("should handle null optional fields", async () => {
      const apiNote = createMockApiCreditNote({
        customer_id: null,
        invoice_id: null,
        issue_date: null,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const creditNote = result.current.data?.[0];
      expect(creditNote?.customerId).toBeNull();
      expect(creditNote?.invoiceId).toBeNull();
      expect(creditNote?.issuedAt).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors", async () => {
      const networkError = new Error("Network Error");
      mockFetch.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle response.ok = false", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe("Failed to fetch credit notes");
    });

    it("should handle 404 errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe("Failed to fetch credit notes");
    });

    it("should handle 401 unauthorized errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should handle invalid JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should handle non-array credit_notes payload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: "not an array" }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it("should handle null credit_notes payload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: null }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it("should handle undefined credit_notes payload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle limit = 0", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [] }),
      });

      renderHook(() => useCreditNotes(0), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("limit=0");
    });

    it("should handle limit = 1", async () => {
      const apiNote = createMockApiCreditNote();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
    });

    it("should handle large limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [] }),
      });

      renderHook(() => useCreditNotes(1000), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("limit=1000");
    });

    it("should handle malformed credit note data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          credit_notes: [{ completely: "wrong", structure: true }, createMockApiCreditNote()],
        }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should handle malformed data gracefully with defaults
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].id).toBe("");
      expect(result.current.data?.[0].currency).toBe("USD");
      expect(result.current.data?.[0].status).toBe("draft");
    });

    it("should handle empty string amounts", async () => {
      const apiNote = createMockApiCreditNote({
        total_amount: "",
        remaining_credit_amount: "",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].totalAmountMinor).toBe(0);
      expect(result.current.data?.[0].remainingAmountMinor).toBe(0);
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle multiple credit notes with various statuses", async () => {
      const notes = [
        createMockApiCreditNote({
          credit_note_id: "cn-1",
          credit_note_number: "CN-001",
          status: "issued",
        }),
        createMockApiCreditNote({
          credit_note_id: "cn-2",
          credit_note_number: "CN-002",
          status: "applied",
        }),
        createMockApiCreditNote({
          credit_note_id: "cn-3",
          credit_note_number: "CN-003",
          status: "voided",
        }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: notes }),
      });

      const { result } = renderHook(() => useCreditNotes(10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data?.[0].status).toBe("issued");
      expect(result.current.data?.[1].status).toBe("applied");
      expect(result.current.data?.[2].status).toBe("voided");
    });

    it("should handle credit notes with different currencies", async () => {
      const notes = [
        createMockApiCreditNote({ currency: "USD" }),
        createMockApiCreditNote({ currency: "EUR" }),
        createMockApiCreditNote({ currency: "GBP" }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: notes }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].currency).toBe("USD");
      expect(result.current.data?.[1].currency).toBe("EUR");
      expect(result.current.data?.[2].currency).toBe("GBP");
    });

    it("should handle credit notes with zero remaining amounts", async () => {
      const apiNote = createMockApiCreditNote({
        total_amount: 10000,
        remaining_credit_amount: 0,
        status: "applied",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const creditNote = result.current.data?.[0];
      expect(creditNote?.totalAmountMinor).toBe(10000);
      expect(creditNote?.remainingAmountMinor).toBe(0);
    });

    it("should handle credit notes without associated invoice", async () => {
      const apiNote = createMockApiCreditNote({
        invoice_id: null,
        status: "draft",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credit_notes: [apiNote] }),
      });

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.[0].invoiceId).toBeNull();
    });
  });
});
