/**
 * Platform Admin App - useCustomersQuery tests
 *
 * Validates TanStack query/mutation flows with optimistic helpers, cache invalidations, and toast notifications.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useCustomersList,
  useCustomer,
  useCustomerActivities,
  useCustomerNotes,
  useAddCustomerNote,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useCustomersQuery,
} from "../useCustomersQuery";
import { apiClient } from "@/lib/api/client";
import { queryKeys, optimisticHelpers, invalidateHelpers } from "@/lib/query-client";
import { logger } from "@/lib/logger";
import { handleError } from "@/lib/utils/error-handler";

jest.unmock("@tanstack/react-query");

const toastMock = jest.fn();

jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/query-client", () => ({
  queryKeys: {
    customers: {
      list: jest.fn((filters) => ["customers", filters]),
      lists: jest.fn(() => ["customers"]),
      detail: jest.fn((id) => ["customers", "detail", id]),
      activities: jest.fn((id) => ["customers", "activities", id]),
      notes: jest.fn((id) => ["customers", "notes", id]),
    },
  },
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

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/lib/utils/error-handler", () => ({
  handleError: jest.fn(),
}));

const mockedQueryKeys = queryKeys as jest.Mocked<typeof queryKeys>;
const mockedOptimistic = optimisticHelpers as jest.Mocked<typeof optimisticHelpers>;
const mockedInvalidate = invalidateHelpers as jest.Mocked<typeof invalidateHelpers>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedHandleError = handleError as jest.Mocked<typeof handleError>;

describe("Platform Admin useCustomersQuery hooks", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { wrapper, queryClient };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches customer lists and detail records", async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [{ id: "cust-1", status: "active", created_at: new Date().toISOString(), lifetime_value: 1000 }] });
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { id: "cust-1" } });

    const { wrapper } = createWrapper();

    const listHook = renderHook(() => useCustomersList({ query: "Jane" }), { wrapper });
    await waitFor(() => expect(listHook.result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith("/customers?q=Jane");

    const detailHook = renderHook(() => useCustomer("cust-1"), { wrapper });
    await waitFor(() => expect(detailHook.result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith("/customers/cust-1");
  });

  it("handles optimistic create/update/delete flows", async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: "cust-2" } });
    (apiClient.put as jest.Mock).mockResolvedValue({ data: { id: "cust-2", name: "Updated" } });
    (apiClient.delete as jest.Mock).mockResolvedValue({});

    const { wrapper, queryClient } = createWrapper();

    const createHook = renderHook(() => useCreateCustomer(), { wrapper });

    await act(async () => {
      await createHook.result.current.mutateAsync({ name: "New" } as any);
    });

    expect(mockedOptimistic.addToList).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      title: "Success",
      description: "Customer created successfully",
    });

    const updateHook = renderHook(() => useUpdateCustomer(), { wrapper });
    queryClient.setQueryData(mockedQueryKeys.customers.detail("cust-2"), { id: "cust-2" });

    await act(async () => {
      await updateHook.result.current.mutateAsync({ id: "cust-2", name: "Updated" } as any);
    });

    expect(mockedOptimistic.updateItem).toHaveBeenCalled();
    expect(mockedInvalidate.invalidateRelated).toHaveBeenCalled();

    const deleteHook = renderHook(() => useDeleteCustomer(), { wrapper });
    await act(async () => {
      await deleteHook.result.current.mutateAsync("cust-2");
    });

    expect(mockedOptimistic.removeFromList).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      title: "Success",
      description: "Customer deleted successfully",
    });
  });

  it("rolls back optimistic update on errors", async () => {
    const error = new Error("fail");
    (apiClient.put as jest.Mock).mockRejectedValue(error);

    const { wrapper, queryClient } = createWrapper();
    const updateHook = renderHook(() => useUpdateCustomer(), { wrapper });

    queryClient.setQueryData(mockedQueryKeys.customers.detail("cust-3"), { id: "cust-3" });

    await act(async () => {
      await expect(
        updateHook.result.current.mutateAsync({ id: "cust-3", name: "Broken" } as any),
      ).rejects.toThrow();
    });

    expect(mockedHandleError).toHaveBeenCalledWith(error, "Failed to update customer", true);
  });

  it("fetches activities and notes plus add note optimistic flow", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
    const { wrapper } = createWrapper();

    renderHook(() => useCustomerActivities("cust-1"), { wrapper });
    renderHook(() => useCustomerNotes("cust-1"), { wrapper });

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith("/customers/cust-1/activities"));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith("/customers/cust-1/notes"));

    const addNoteHook = renderHook(() => useAddCustomerNote("cust-1"), { wrapper });
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: "note-1" } });

    await act(async () => {
      await addNoteHook.result.current.mutateAsync("Great customer");
    });

    expect(mockedOptimistic.addToList).toHaveBeenCalled();
    expect(mockedInvalidate.invalidateRelated).toHaveBeenCalled();
  });

  it("exposes aggregated metrics in useCustomersQuery", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: [
        { id: "cust-1", status: "active", created_at: new Date().toISOString(), lifetime_value: 500 },
        { id: "cust-2", status: "inactive", created_at: new Date().toISOString(), lifetime_value: 300 },
      ],
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCustomersQuery({ status: "all" }), { wrapper });

    await waitFor(() => expect(result.current.customers.length).toBe(2));
    expect(result.current.metrics.totalCustomers).toBe(2);
    expect(result.current.metrics.activeCustomers).toBe(1);
    expect(result.current.metrics.totalRevenue).toBe(800);
  });
});
