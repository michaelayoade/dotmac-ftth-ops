/**
 * Platform Admin App - useObservability tests
 *
 * Validates trace fetching and detail helpers.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useTraces } from "../useObservability";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;

describe("Platform Admin useObservability hooks", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches traces and trace details", async () => {
    mockedApi.get
      .mockResolvedValueOnce({
        data: {
          traces: [{ trace_id: "trace-1", status: "success", spans: 2 }],
          total: 1,
          page: 1,
          page_size: 50,
          has_more: false,
        },
      })
      .mockResolvedValueOnce({
        data: { trace_id: "trace-1", spans: [] },
      });

    const { result } = renderHook(() => useTraces({ service: "billing" }), { wrapper });

    await waitFor(() => expect(result.current.traces.length).toBe(1));
    expect(mockedApi.get).toHaveBeenCalledWith("/observability/traces?service=billing");

    const detail = await result.current.fetchTraceDetails("trace-1");
    expect(mockedApi.get).toHaveBeenCalledWith("/observability/traces/trace-1");
    expect(detail?.trace_id).toBe("trace-1");
    expect(logger.info).toHaveBeenCalled();
  });
});
