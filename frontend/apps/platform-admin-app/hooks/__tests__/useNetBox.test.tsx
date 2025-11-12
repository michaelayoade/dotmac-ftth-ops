/**
 * Platform Admin App - useNetBox tests
 *
 * Ensures NetBox health/ip hooks hit the REST API and invalidate caches.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useNetBoxHealth, useCreateIPAddress } from "../useNetBox";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const toastMock = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;

describe("Platform Admin useNetBox hooks", () => {
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
    toastMock.mockClear();
  });

  it("fetches NetBox health data", async () => {
    mockedApi.get.mockResolvedValue({ data: { status: "healthy" } });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useNetBoxHealth(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith("/netbox/health");
    expect(result.current.data?.status).toBe("healthy");
  });

  it("creates IP addresses and invalidates queries", async () => {
    mockedApi.post.mockResolvedValue({ data: { address: "192.0.2.1" } });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateIPAddress(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ address: "192.0.2.1" } as any);
    });

    expect(mockedApi.post).toHaveBeenCalledWith("/netbox/ipam/ip-addresses", {
      address: "192.0.2.1",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["netbox", "ip-addresses"] });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "IP Address Created" }),
    );
  });
});
