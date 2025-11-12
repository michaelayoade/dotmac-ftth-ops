/**
 * Platform Admin App - useCRM tests
 *
 * Validates lead queries and optimistic creation flows.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useLeads, useCreateLead, crmKeys } from "../useCRM";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { optimisticHelpers } from "@/lib/query-client";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/lib/query-client", () => ({
  optimisticHelpers: {
    addToList: jest.fn(),
    updateInList: jest.fn(),
    updateItem: jest.fn(),
    removeFromList: jest.fn(),
  },
  invalidateHelpers: {
    invalidateRelated: jest.fn(),
  },
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;
const mockedOptimistic = optimisticHelpers as jest.Mocked<typeof optimisticHelpers>;

describe("Platform Admin useCRM hooks", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { wrapper, queryClient };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches leads with filters", async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: "lead-1", status: "new" }] });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLeads({ status: "new" }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith("/crm/leads?status=new");
    expect(result.current.data?.[0].id).toBe("lead-1");
  });

  it("creates leads optimistically and invalidates caches", async () => {
    mockedApi.post.mockResolvedValue({ data: { id: "lead-123", status: "new" } });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateLead(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        first_name: "Jane",
        last_name: "Doe",
        lead_number: "L-1",
        tenant_id: "tenant",
        status: "new",
        source: "website",
        priority: 1,
        interested_service_types: [],
        service_address_line1: "123 Main",
        service_city: "Austin",
        service_state_province: "TX",
        service_postal_code: "78701",
        service_country: "USA",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);
    });

    expect(mockedOptimistic.addToList).toHaveBeenCalledWith(
      expect.any(Object),
      crmKeys.leads.lists(),
      expect.objectContaining({ first_name: "Jane" }),
      { position: "start" },
    );
    expect(mockedOptimistic.updateInList).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: crmKeys.leads.lists() });
  });
});
