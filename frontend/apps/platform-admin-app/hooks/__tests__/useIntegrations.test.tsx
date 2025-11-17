/**
 * Platform Admin App - useIntegrations tests
 *
 * Ensures integration queries/mutations work and helper utilities behave.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useIntegrations,
  useIntegration,
  useHealthCheck,
  getStatusColor,
  getStatusIcon,
  getTypeColor,
  getTypeIcon,
} from "../useIntegrations";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import { useToast } from "@dotmac/ui";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

const global.mockToast = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: global.mockToast,
  }),
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;

describe("Platform Admin useIntegrations hooks", () => {
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

  it("fetches integrations and single integration detail", async () => {
    mockedApi.get
      .mockResolvedValueOnce({
        data: { integrations: [{ name: "segment", status: "ready" }], total: 1 },
      })
      .mockResolvedValueOnce({
        data: { name: "segment", status: "ready" },
      });

    const { wrapper } = createWrapper();
    const listHook = renderHook(() => useIntegrations(), { wrapper });
    await waitFor(() => expect(listHook.result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith("/integrations");

    const detailHook = renderHook(() => useIntegration("segment"), { wrapper });
    await waitFor(() => expect(detailHook.result.current.data?.name).toBe("segment"));
    expect(mockedApi.get).toHaveBeenCalledWith("/integrations/segment");
  });

  it("runs health check mutation and invalidates caches", async () => {
    mockedApi.post.mockResolvedValue({
      data: { name: "segment", status: "ready" },
    });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useHealthCheck(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("segment");
    });

    expect(mockedApi.post).toHaveBeenCalledWith("/integrations/segment/health-check");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["integrations"] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["integrations", "segment"],
    });
    expect(global.mockToast).toHaveBeenCalledWith({
      title: "Health check complete",
      description: "segment: ready",
    });
  });

  it("provides status/type helpers", () => {
    expect(getStatusColor("ready")).toContain("emerald");
    expect(getStatusIcon("error")).toBe("✗");
    expect(getTypeColor("email")).toContain("blue");
    expect(getTypeIcon("analytics")).toBe("📊");
  });
});
