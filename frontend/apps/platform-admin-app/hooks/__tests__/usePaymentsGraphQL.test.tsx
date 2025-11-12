/**
 * Platform Admin App - usePaymentsGraphQL tests
 *
 * Validates payment queries and metrics requests.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { usePayment, usePaymentMetrics } from "../usePaymentsGraphQL";
import { graphqlClient } from "@/lib/graphql-client";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/graphql-client", () => ({
  graphqlClient: {
    request: jest.fn(),
  },
}));

const mockedClient = graphqlClient as jest.Mocked<typeof graphqlClient>;

describe("Platform Admin usePaymentsGraphQL hooks", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches payment detail with related entities", async () => {
    mockedClient.request.mockResolvedValueOnce({
      payment: { id: "pay-1", amount: 100, customer: null, invoice: null },
    });

    const { result } = renderHook(() => usePayment("pay-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("pay-1");
    expect(mockedClient.request).toHaveBeenCalled();
  });

  it("fetches payment metrics", async () => {
    mockedClient.request.mockResolvedValueOnce({
      paymentMetrics: { totalPayments: 5 },
    });

    const { result } = renderHook(() => usePaymentMetrics(), { wrapper });

    await waitFor(() => expect(result.current.data?.totalPayments).toBe(5));
    expect(mockedClient.request).toHaveBeenCalled();
  });
});
