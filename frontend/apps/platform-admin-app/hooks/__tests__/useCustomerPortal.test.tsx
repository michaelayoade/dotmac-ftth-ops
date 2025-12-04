/**
 * Platform Admin App - useCustomerPortal tests
 *
 * Ensures portal profile queries and mutations use the authenticated fetch helper.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useCustomerProfile } from "../useCustomerPortal";
import { logger } from "@/lib/logger";
import { customerPortalKeys } from "../useCustomerPortal";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const buildUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const prefixed = normalized.startsWith("/api/isp/v1/portal") ? normalized : `/api/isp/v1/portal${normalized}`;
  return `https://api.example.com${prefixed}`;
};

jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      baseUrl: "https://api.example.com",
      prefix: "/api/isp/v1/portal",
      buildUrl,
    },
    features: {},
    branding: {},
    tenant: {},
  }),
}));

jest.mock("../../../../shared/utils/operatorAuth", () => {
  const fetchMock = jest.fn();
  return {
    createPortalAuthFetch: jest.fn(() => fetchMock),
    CUSTOMER_PORTAL_TOKEN_KEY: "token",
    PortalAuthError: class PortalAuthError extends Error {},
    __fetchMock: fetchMock,
  };
});

const { __fetchMock: portalFetchMock } = jest.requireMock(
  "../../../../shared/utils/operatorAuth",
) as { __fetchMock: jest.Mock };

const mockedLogger = logger as jest.Mocked<typeof logger>;

describe("Platform Admin useCustomerPortal hooks", () => {
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
    portalFetchMock.mockReset();
  });

  it("fetches and updates customer profile with optimistic mutation", async () => {
    const profile = { id: "profile-1", first_name: "Jane", last_name: "Doe" };
    portalFetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(profile),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...profile, phone: "555-1234" }),
      });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCustomerProfile(), { wrapper });

    await waitFor(() => expect(result.current.profile?.id).toBe("profile-1"));
    expect(portalFetchMock).toHaveBeenCalledWith("https://api.example.com/api/isp/v1/portal/customer/profile");

    await act(async () => {
      await result.current.updateProfile({ phone: "555-1234" } as any);
    });

    expect(portalFetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/isp/v1/portal/customer/profile",
      expect.objectContaining({
        method: "PUT",
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: customerPortalKeys.profile() });
    expect(mockedLogger.info).toHaveBeenCalled();
  });
});
