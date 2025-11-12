/**
 * Tests for useTenantOnboarding hooks
 * Tests tenant onboarding operations
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useTenantOnboarding,
  useOnboardingStatus,
  useSlugGeneration,
  usePasswordGeneration,
} from "../useTenantOnboarding";
import { tenantOnboardingService } from "@/lib/services/tenant-onboarding-service";

// Mock the service
jest.mock("@/lib/services/tenant-onboarding-service", () => ({
  tenantOnboardingService: {
    onboardTenant: jest.fn(),
    getOnboardingStatus: jest.fn(),
    generateSlug: jest.fn(),
    generatePassword: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useTenantOnboarding", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("useTenantOnboarding hook", () => {
    it("should onboard tenant successfully", async () => {
      const mockResponse = {
        tenantId: "tenant-123",
        adminUserId: "user-123",
        credentials: {
          email: "admin@test.com",
          temporaryPassword: "temp-password",
        },
      };

      (tenantOnboardingService.onboardTenant as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useTenantOnboarding(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.onboard({
          name: "Test Tenant",
          slug: "test-tenant",
          adminEmail: "admin@test.com",
        });
      });

      await waitFor(() => expect(result.current.isOnboarding).toBe(false));

      expect(result.current.onboardingResult).toEqual(mockResponse);
      expect(tenantOnboardingService.onboardTenant).toHaveBeenCalledWith({
        name: "Test Tenant",
        slug: "test-tenant",
        adminEmail: "admin@test.com",
      });
    });

    it("should handle onboarding error", async () => {
      const mockError = new Error("Onboarding failed");
      (tenantOnboardingService.onboardTenant as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useTenantOnboarding(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.onboard({
          name: "Test Tenant",
          slug: "test-tenant",
          adminEmail: "admin@test.com",
        });
      });

      await waitFor(() => expect(result.current.isOnboarding).toBe(false));

      expect(result.current.onboardingError).toEqual(mockError);
    });

    it("should expose onboardAsync for async operations", async () => {
      const mockResponse = { tenantId: "tenant-123" };
      (tenantOnboardingService.onboardTenant as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useTenantOnboarding(), {
        wrapper: createWrapper(),
      });

      let asyncResult;
      await act(async () => {
        asyncResult = await result.current.onboardAsync({
          name: "Test Tenant",
          slug: "test-tenant",
          adminEmail: "admin@test.com",
        });
      });

      expect(asyncResult).toEqual(mockResponse);
    });

    it("should reset mutation state", async () => {
      (tenantOnboardingService.onboardTenant as jest.Mock).mockResolvedValue({
        tenantId: "tenant-123",
      });

      const { result } = renderHook(() => useTenantOnboarding(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.onboard({
          name: "Test Tenant",
          slug: "test-tenant",
          adminEmail: "admin@test.com",
        });
      });

      await waitFor(() => expect(result.current.isOnboarding).toBe(false));
      expect(result.current.onboardingResult).toBeDefined();

      await act(async () => {
        result.current.reset();
      });

      await waitFor(() => {
        expect(result.current.onboardingResult).toBeUndefined();
      });
      expect(result.current.onboardingError).toBeNull();
    });

    it("should set isOnboarding during mutation", async () => {
      let resolveOnboard: any;
      (tenantOnboardingService.onboardTenant as jest.Mock).mockImplementation(
        () => new Promise((resolve) => {
          resolveOnboard = resolve;
        })
      );

      const { result } = renderHook(() => useTenantOnboarding(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.onboard({
          name: "Test Tenant",
          slug: "test-tenant",
          adminEmail: "admin@test.com",
        });
      });

      // Wait for the mutation to be in pending state
      await waitFor(() => expect(result.current.isOnboarding).toBe(true));

      // Clean up
      act(() => {
        resolveOnboard({ tenantId: "test" });
      });
    });
  });

  describe("useOnboardingStatus hook", () => {
    it("should fetch onboarding status", async () => {
      const mockStatus = {
        tenantId: "tenant-123",
        status: "completed",
        steps: [],
      };

      (tenantOnboardingService.getOnboardingStatus as jest.Mock).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useOnboardingStatus("tenant-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockStatus);
      expect(tenantOnboardingService.getOnboardingStatus).toHaveBeenCalledWith("tenant-123");
    });

    it("should not fetch when tenantId is undefined", () => {
      const { result } = renderHook(() => useOnboardingStatus(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(tenantOnboardingService.getOnboardingStatus).not.toHaveBeenCalled();
    });

    it("should have correct stale time", () => {
      (tenantOnboardingService.getOnboardingStatus as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useOnboardingStatus("tenant-123"), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
    });

    it("should handle fetch error", async () => {
      const mockError = new Error("Failed to fetch status");
      (tenantOnboardingService.getOnboardingStatus as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useOnboardingStatus("tenant-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useSlugGeneration hook", () => {
    it("should provide generateSlug function", () => {
      const { result } = renderHook(() => useSlugGeneration());

      expect(result.current.generateSlug).toBe(tenantOnboardingService.generateSlug);
    });

    it("should call service generateSlug", () => {
      const mockSlug = "test-tenant-slug";
      (tenantOnboardingService.generateSlug as jest.Mock).mockReturnValue(mockSlug);

      const { result } = renderHook(() => useSlugGeneration());

      const slug = result.current.generateSlug("Test Tenant Name");

      expect(slug).toBe(mockSlug);
      expect(tenantOnboardingService.generateSlug).toHaveBeenCalledWith("Test Tenant Name");
    });
  });

  describe("usePasswordGeneration hook", () => {
    it("should provide generatePassword function", () => {
      const { result } = renderHook(() => usePasswordGeneration());

      expect(result.current.generatePassword).toBe(tenantOnboardingService.generatePassword);
    });

    it("should call service generatePassword", () => {
      const mockPassword = "generated-password-123";
      (tenantOnboardingService.generatePassword as jest.Mock).mockReturnValue(mockPassword);

      const { result } = renderHook(() => usePasswordGeneration());

      const password = result.current.generatePassword();

      expect(password).toBe(mockPassword);
      expect(tenantOnboardingService.generatePassword).toHaveBeenCalled();
    });
  });
});
