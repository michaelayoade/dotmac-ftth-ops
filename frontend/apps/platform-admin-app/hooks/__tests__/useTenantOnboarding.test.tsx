/**
 * Platform Admin App - useTenantOnboarding tests
 *
 * Covers onboarding mutations, status polling, and helper utilities.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useTenantOnboarding,
  useOnboardingStatus,
  useSlugGeneration,
  usePasswordGeneration,
} from "../useTenantOnboarding";
import { tenantOnboardingService } from "@/lib/services/tenant-onboarding-service";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/services/tenant-onboarding-service", () => {
  const service = {
    onboardTenant: jest.fn(),
    getOnboardingStatus: jest.fn(),
    generateSlug: jest.fn((name: string) => `${name}-slug`),
    generatePassword: jest.fn(() => "SecurePass123!"),
  };
  return { tenantOnboardingService: service };
});

const mockedService = tenantOnboardingService as jest.Mocked<typeof tenantOnboardingService>;

describe("Platform Admin useTenantOnboarding hooks", () => {
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

  it("onboards tenants and invalidates platform tenant caches", async () => {
    mockedService.onboardTenant.mockResolvedValue({
      tenant: { id: "tenant-1" },
    } as any);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTenantOnboarding(), { wrapper });

    await act(async () => {
      await result.current.onboardAsync({
        tenant: { name: "Acme", slug: "acme" },
        options: {} as any,
      } as any);
    });

    expect(mockedService.onboardTenant).toHaveBeenCalledWith({
      tenant: { name: "Acme", slug: "acme" },
      options: {},
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["platform-tenants"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tenants"] });
    await waitFor(() => expect(result.current.isOnboarding).toBe(false));
    expect(result.current.onboardingResult).toEqual({ tenant: { id: "tenant-1" } });
  });

  it("fetches onboarding status when tenant id is provided", async () => {
    mockedService.getOnboardingStatus.mockResolvedValue({
      tenant_id: "tenant-1",
      status: "in_progress",
      completed: false,
      metadata: {},
      updated_at: "now",
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useOnboardingStatus("tenant-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedService.getOnboardingStatus).toHaveBeenCalledWith("tenant-1");
    expect(result.current.data?.status).toBe("in_progress");
  });

  it("skips onboarding status query when tenant id is missing", () => {
    const { wrapper } = createWrapper();
    renderHook(() => useOnboardingStatus(undefined), { wrapper });
    expect(mockedService.getOnboardingStatus).not.toHaveBeenCalled();
  });

  it("delegates slug and password generation utilities", () => {
    const slugHook = renderHook(() => useSlugGeneration());
    expect(slugHook.result.current.generateSlug("Acme Corp")).toBe("Acme Corp-slug");
    expect(mockedService.generateSlug).toHaveBeenCalledWith("Acme Corp");

    const passwordHook = renderHook(() => usePasswordGeneration());
    expect(passwordHook.result.current.generatePassword()).toBe("SecurePass123!");
    expect(mockedService.generatePassword).toHaveBeenCalled();
  });
});
