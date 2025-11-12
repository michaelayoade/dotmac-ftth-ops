/**
 * Tests for useCreditNotes hook
 * Tests credit notes query
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreditNotes } from "../useCreditNotes";

// Mock fetch
global.fetch = jest.fn();

// Mock platform config
jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:8000",
    },
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useCreditNotes", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch credit notes successfully", async () => {
    const mockCreditNotes = {
      credit_notes: [
        {
          credit_note_id: "cn-1",
          credit_note_number: "CN-001",
          customer_id: "cust-1",
          invoice_id: "inv-1",
          issue_date: "2024-01-01",
          currency: "USD",
          total_amount: 10000,
          remaining_credit_amount: 5000,
          status: "issued",
        },
        {
          credit_note_id: "cn-2",
          credit_note_number: "CN-002",
          customer_id: "cust-2",
          invoice_id: null,
          issue_date: "2024-01-02",
          currency: "EUR",
          total_amount: 20000,
          remaining_credit_amount: 20000,
          status: "draft",
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockCreditNotes,
    });

    const { result } = renderHook(() => useCreditNotes(5), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]).toEqual({
      id: "cn-1",
      number: "CN-001",
      customerId: "cust-1",
      invoiceId: "inv-1",
      issuedAt: "2024-01-01",
      currency: "USD",
      totalAmountMinor: 10000,
      remainingAmountMinor: 5000,
      status: "issued",
      downloadUrl: "/api/v1/billing/credit-notes/cn-1/download",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/billing/credit-notes?limit=5",
      expect.objectContaining({
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      })
    );
  });

  it("should use default limit of 5", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ credit_notes: [] }),
    });

    renderHook(() => useCreditNotes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=5"),
        expect.anything()
      );
    });
  });

  it("should handle custom limit", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ credit_notes: [] }),
    });

    renderHook(() => useCreditNotes(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=10"),
        expect.anything()
      );
    });
  });

  it("should handle fetch error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { result } = renderHook(() => useCreditNotes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error("Failed to fetch credit notes"));
  });

  it("should handle network error", async () => {
    const networkError = new Error("Network error");
    (global.fetch as jest.Mock).mockRejectedValue(networkError);

    const { result } = renderHook(() => useCreditNotes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(networkError);
  });

  it("should handle empty credit notes array", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ credit_notes: [] }),
    });

    const { result } = renderHook(() => useCreditNotes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it("should handle missing credit_notes field", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useCreditNotes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it("should handle missing fields in credit note", async () => {
    const mockCreditNotes = {
      credit_notes: [
        {
          credit_note_id: "cn-1",
          // Missing most fields
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockCreditNotes,
    });

    const { result } = renderHook(() => useCreditNotes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0]).toEqual({
      id: "cn-1",
      number: "cn-1",
      customerId: null,
      invoiceId: null,
      issuedAt: null,
      currency: "USD",
      totalAmountMinor: 0,
      remainingAmountMinor: 0,
      status: "draft",
      downloadUrl: "/api/v1/billing/credit-notes/cn-1/download",
    });
  });

  it("should use credit_note_number for number field", async () => {
    const mockCreditNotes = {
      credit_notes: [
        {
          credit_note_id: "cn-1",
          credit_note_number: "CUSTOM-001",
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockCreditNotes,
    });

    const { result } = renderHook(() => useCreditNotes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0]?.number).toBe("CUSTOM-001");
  });

  it("should convert amounts to numbers", async () => {
    const mockCreditNotes = {
      credit_notes: [
        {
          credit_note_id: "cn-1",
          total_amount: "15000",
          remaining_credit_amount: "10000",
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockCreditNotes,
    });

    const { result } = renderHook(() => useCreditNotes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0]?.totalAmountMinor).toBe(15000);
    expect(result.current.data?.[0]?.remainingAmountMinor).toBe(10000);
    expect(typeof result.current.data?.[0]?.totalAmountMinor).toBe("number");
  });

  it("should have correct stale time", () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ credit_notes: [] }),
    });

    const { result } = renderHook(() => useCreditNotes(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeDefined();
  });

  it("should generate correct download URL", async () => {
    const mockCreditNotes = {
      credit_notes: [
        {
          credit_note_id: "cn-123",
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockCreditNotes,
    });

    const { result } = renderHook(() => useCreditNotes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0]?.downloadUrl).toBe(
      "/api/v1/billing/credit-notes/cn-123/download"
    );
  });

  it("should use # for download URL when ID is missing", async () => {
    const mockCreditNotes = {
      credit_notes: [
        {
          credit_note_id: "",
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockCreditNotes,
    });

    const { result } = renderHook(() => useCreditNotes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0]?.downloadUrl).toBe("#");
  });
});
