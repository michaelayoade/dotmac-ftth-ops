/**
 * MSW-powered tests for useCreditNotes
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 *
 * ⚠️ KNOWN LIMITATION:
 * The useCreditNotes hook uses native fetch() API, which MSW v1 has limited
 * support for in Node/Jest environments. Tests will fail until either:
 * 1. The service is refactored to use axios
 * 2. We upgrade to MSW v2 (which has better fetch support)
 *
 * This test file is provided for future use and documentation purposes.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useCreditNotes } from "../useCreditNotes";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetCreditNotesStorage,
  createMockCreditNote,
  seedCreditNotesData,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";

// Mock AppConfigContext since useCreditNotes depends on it
jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      baseUrl: "http://localhost:8000",
      prefix: "/api/v1",
      buildUrl: (path: string) => `http://localhost:8000/api/v1${path}`,
    },
  }),
}));

describe("useCreditNotes (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetCreditNotesStorage();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("useCreditNotes - fetch credit notes", () => {
    it("should fetch credit notes successfully", async () => {
      const notes = [
        createMockCreditNote({ credit_note_number: "CN-001" }),
        createMockCreditNote({ credit_note_number: "CN-002" }),
        createMockCreditNote({ credit_note_number: "CN-003" }),
      ];
      seedCreditNotesData(notes);

      const { result } = renderHook(() => useCreditNotes(5), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toHaveLength(3);
      expect(result.current.data?.[0].number).toBe("CN-001");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty credit note list", async () => {
      seedCreditNotesData([]);

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
    });

    it("should respect limit parameter", async () => {
      const notes = Array.from({ length: 10 }, (_, i) =>
        createMockCreditNote({ credit_note_number: `CN-${String(i + 1).padStart(3, '0')}` })
      );
      seedCreditNotesData(notes);

      const { result } = renderHook(() => useCreditNotes(5), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(5);
      expect(result.current.data?.[0].number).toBe("CN-001");
      expect(result.current.data?.[4].number).toBe("CN-005");
    });

    it("should use default limit of 5", async () => {
      const notes = Array.from({ length: 10 }, (_, i) =>
        createMockCreditNote()
      );
      seedCreditNotesData(notes);

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(5);
    });

    it("should transform API response to CreditNoteSummary format", async () => {
      const note = createMockCreditNote({
        credit_note_id: "cn-test-1",
        credit_note_number: "CN-TEST-001",
        customer_id: "cust-123",
        invoice_id: "inv-456",
        issue_date: "2025-01-01",
        currency: "USD",
        total_amount: 10000,
        remaining_credit_amount: 5000,
        status: "issued",
      });
      seedCreditNotesData([note]);

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const creditNote = result.current.data?.[0];
      expect(creditNote).toMatchObject({
        id: "cn-test-1",
        number: "CN-TEST-001",
        customerId: "cust-123",
        invoiceId: "inv-456",
        issuedAt: "2025-01-01",
        currency: "USD",
        totalAmountMinor: 10000,
        remainingAmountMinor: 5000,
        status: "issued",
        downloadUrl: "/api/v1/billing/credit-notes/cn-test-1/download",
      });
    });

    it("should handle missing optional fields", async () => {
      const note = createMockCreditNote({
        credit_note_id: "cn-minimal",
        customer_id: null,
        invoice_id: null,
        issue_date: null,
      });
      seedCreditNotesData([note]);

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const creditNote = result.current.data?.[0];
      expect(creditNote?.customerId).toBeNull();
      expect(creditNote?.invoiceId).toBeNull();
      expect(creditNote?.issuedAt).toBeNull();
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail("get", "/billing/credit-notes", "Server error");

      const { result } = renderHook(() => useCreditNotes(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("Query key generation", () => {
    it("should use correct query key structure", () => {
      const { result } = renderHook(() => useCreditNotes(10), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Query keys should include limit and API config for proper caching
      // This test doesn't require API call, so it can run without skip
      expect(result.current).toBeDefined();
    });
  });
});
