/**
 * Platform Admin App - useNetworkInventory tests
 *
 * Ensures NetBox health/sites hooks call the API client and respect options.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useNetboxHealth, useNetboxSites } from "../useNetworkInventory";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

const mockedExtract = extractDataOrThrow as jest.Mock;

describe("Platform Admin useNetworkInventory hooks", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches NetBox health when enabled", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { status: "healthy" } });
    const { result } = renderHook(() => useNetboxHealth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith("/netbox/health");
    expect(mockedExtract).toHaveBeenCalled();
    expect(result.current.data).toEqual({ status: "healthy" });
  });

  it("fetches NetBox sites with pagination params", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [{ id: "site-1" }] });
    const { result } = renderHook(() => useNetboxSites({ limit: 10, offset: 5 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith("/netbox/dcim/sites", {
      params: { limit: 10, offset: 5 },
    });
    expect(result.current.data?.[0].id).toBe("site-1");
  });

  it("respects the enabled flag", () => {
    renderHook(() => useNetboxHealth({ enabled: false }), { wrapper: createWrapper() });
    renderHook(() => useNetboxSites({ enabled: false }), { wrapper: createWrapper() });
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
