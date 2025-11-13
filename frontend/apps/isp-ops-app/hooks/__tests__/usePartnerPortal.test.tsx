/**
 * Platform Admin App - usePartnerPortal tests
 *
 * Ensures portal queries/mutations use authenticated fetch endpoints.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { usePartnerDashboard, useUpdatePartnerProfile, usePartnerProfile } from "../usePartnerPortal";
import { useToast } from "@dotmac/ui";

jest.unmock("@tanstack/react-query");

const toastMock = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

const buildUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const prefixed = normalized.startsWith("/api/v1") ? normalized : `/api/v1${normalized}`;
  return `https://api.example.com${prefixed}`;
};

jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      baseUrl: "https://api.example.com",
      prefix: "/api/v1",
      buildUrl,
    },
    features: {},
    branding: {},
    tenant: {},
  }),
}));

const fetchMock = jest.fn();

describe("Platform Admin usePartnerPortal hooks", () => {
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
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it("fetches dashboard stats and updates partner profile", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ total_customers: 10 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "partner-1", company_name: "Acme" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "partner-1", company_name: "Acme Updated" }),
      });

    const { wrapper, queryClient } = createWrapper();
    const dashboardHook = renderHook(() => usePartnerDashboard(), { wrapper });
    await waitFor(() => expect(dashboardHook.result.current.data?.total_customers).toBe(10));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/partners/portal/dashboard",
      expect.any(Object),
    );

    const profileHook = renderHook(() => usePartnerProfile(), { wrapper });
    await waitFor(() => expect(profileHook.result.current.data?.company_name).toBe("Acme"));

    const updateHook = renderHook(() => useUpdatePartnerProfile(), { wrapper });
    await act(async () => {
      await updateHook.result.current.mutateAsync({ company_name: "Acme Updated" });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/partners/portal/profile",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
