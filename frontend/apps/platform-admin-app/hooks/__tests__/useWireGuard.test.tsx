/**
 * Platform Admin App - useWireGuard tests
 *
 * Ensures server queries and mutations call the backend and invalidate caches.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useWireGuardServers, useCreateWireGuardServer, wireGuardKeys } from "../useWireGuard";
import { apiClient } from "@/lib/api/client";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;

describe("Platform Admin useWireGuard hooks", () => {
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

  it("lists WireGuard servers with filters", async () => {
    mockedApi.get.mockResolvedValue({
      data: [{ id: "srv-1", name: "WG-1" }],
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useWireGuardServers({ status: "active", limit: 5 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mockedApi.get).toHaveBeenCalledWith("/wireguard/servers?status=active&limit=5");
    expect(result.current.data?.[0].name).toBe("WG-1");
  });

  it("creates servers and invalidates list/dashboard caches", async () => {
    mockedApi.post.mockResolvedValue({ data: { id: "srv-2" } });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateWireGuardServer(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "WG-2" } as any);
    });

    expect(mockedApi.post).toHaveBeenCalledWith("/wireguard/servers", { name: "WG-2" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wireGuardKeys.servers.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wireGuardKeys.dashboard() });
  });
});
