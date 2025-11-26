/**
 * Platform Admin App - useBillingGraphQL tests
 *
 * Ensures billing/subscription GraphQL hooks issue the expected requests.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useSubscription, useBillingMetrics, useActiveSubscriptions } from "../useBillingGraphQL";
import { graphqlClient } from "@/lib/graphql-client";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/graphql-client", () => ({
  graphqlClient: {
    request: jest.fn(),
  },
}));

const mockedClient = graphqlClient as jest.Mocked<typeof graphqlClient>;

describe("Platform Admin useBillingGraphQL hooks", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { wrapper };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches a subscription with related data", async () => {
    mockedClient.request.mockResolvedValueOnce({
      subscription: { id: "sub-1", status: "active" },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSubscription("sub-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedClient.request).toHaveBeenCalled();
    expect(result.current.data?.id).toBe("sub-1");
  });

  it("fetches billing metrics for a period", async () => {
    mockedClient.request.mockResolvedValueOnce({
      billingMetrics: { mrr: 1000 },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingMetrics("90d"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedClient.request).toHaveBeenCalledWith(expect.any(String), { period: "90d" });
    expect(result.current.data?.mrr).toBe(1000);
  });

  it("returns active subscriptions via convenience hook", async () => {
    mockedClient.request.mockResolvedValue({
      subscriptions: { subscriptions: [{ id: "sub-2" }] },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useActiveSubscriptions(), { wrapper });

    await waitFor(() => expect(result.current.data?.subscriptions.length).toBe(1));
    expect(mockedClient.request).toHaveBeenCalled();
  });
});
