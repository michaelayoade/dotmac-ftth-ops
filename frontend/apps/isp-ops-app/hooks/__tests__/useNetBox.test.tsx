/**
 * Unit tests for NetBox IPAM/DCIM hooks to ensure query params align with backend expectations.
 */

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock("@dotmac/ui", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { apiClient } from "@/lib/api/client";
import { useIPAddresses, usePrefixes } from "../useNetBox";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useNetBox query params", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  it("uses backend vrf param when listing IP addresses", async () => {
    const { result } = renderHook(() => useIPAddresses({ vrf: "core", limit: 10, offset: 5 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = (apiClient.get as jest.Mock).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/netbox/ipam/ip-addresses?");
    expect(calledUrl).toContain("vrf=core");
    expect(calledUrl).toContain("limit=10");
    expect(calledUrl).toContain("offset=5");
  });

  it("maps legacy vrf_id param to vrf for IP addresses", async () => {
    const { result } = renderHook(() => useIPAddresses({ vrf_id: 7 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = (apiClient.get as jest.Mock).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("vrf=7");
    expect(calledUrl).not.toContain("vrf_id=");
  });

  it("uses backend vrf param when listing prefixes", async () => {
    const { result } = renderHook(() => usePrefixes({ vrf: "blue", limit: 25, offset: 10 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = (apiClient.get as jest.Mock).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/netbox/ipam/prefixes?");
    expect(calledUrl).toContain("vrf=blue");
    expect(calledUrl).toContain("limit=25");
    expect(calledUrl).toContain("offset=10");
  });

  it("maps legacy vrf_id param to vrf for prefixes", async () => {
    const { result } = renderHook(() => usePrefixes({ vrf_id: 42 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = (apiClient.get as jest.Mock).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("vrf=42");
    expect(calledUrl).not.toContain("vrf_id=");
  });
});
