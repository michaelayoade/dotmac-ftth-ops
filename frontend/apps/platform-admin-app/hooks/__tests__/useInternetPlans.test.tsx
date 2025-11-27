/**
 * Platform Admin App - useInternetPlans tests
 *
 * Ensures plan queries and mutations call the REST API and invalidate caches.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useInternetPlans, useCreateInternetPlan, internetPlanKeys } from "../useInternetPlans";
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

describe("Platform Admin useInternetPlans hooks", () => {
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

  it("lists internet plans with filters", async () => {
    mockedApi.get.mockResolvedValue({
      data: [{ plan_id: "plan-1", name: "Gigabit" }],
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInternetPlans({ status: "active", limit: 5 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith("/services/internet-plans?status=active&limit=5");
    expect(result.current.data?.[0].name).toBe("Gigabit");
  });

  it("creates plans and invalidates caches", async () => {
    mockedApi.post.mockResolvedValue({ data: { plan_id: "plan-2" } });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateInternetPlan(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        product_id: "prod-1",
        billing_interval: "monthly",
      } as any);
    });

    expect(mockedApi.post).toHaveBeenCalledWith("/services/internet-plans", {
      product_id: "prod-1",
      billing_interval: "monthly",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: internetPlanKeys.lists() });
  });
});
