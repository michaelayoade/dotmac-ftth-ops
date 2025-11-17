/**
 * Platform Admin App - useFiberMaps tests
 *
 * Exercises cable queries and mutations plus toast notifications.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useFiberCables, fiberMapsKeys } from "../useFiberMaps";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;

describe("Platform Admin useFiberMaps hooks", () => {
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

  it("fetches fiber cables with filters", async () => {
    mockedApi.get.mockResolvedValue({
      data: { cables: [{ id: "cable-1", cable_name: "Backbone" }] },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFiberCables({ status: "active" }), { wrapper });

    await waitFor(() => expect(result.current.cables.length).toBe(1));
    expect(mockedApi.get).toHaveBeenCalledWith("/fibermaps/cables?status=active");
  });

  it("creates cables and invalidates cache", async () => {
    mockedApi.post.mockResolvedValue({
      data: { id: "cable-2", cable_name: "Spur" },
    });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useFiberCables(), { wrapper });

    await act(async () => {
      await result.current.createCable({ cable_name: "Spur" } as any);
    });

    expect(mockedApi.post).toHaveBeenCalledWith("/fibermaps/cables", {
      cable_name: "Spur",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: fiberMapsKeys.cables({}) });
    expect(global.mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Cable Created" }),
    );
  });
});
