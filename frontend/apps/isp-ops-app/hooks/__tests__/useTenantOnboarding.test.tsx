/**
 * Jest Tests for useTenantOnboarding Hooks
 *
 * Tests tenant onboarding operations including onboarding mutation,
 * onboarding status query, and helper functions for slug and password generation.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useTenantOnboarding,
  useOnboardingStatus,
  useSlugGeneration,
  usePasswordGeneration,
} from "../useTenantOnboarding";
import * as tenantOnboardingService from "@/lib/services/tenant-onboarding-service";
import type {
  TenantOnboardingRequest,
  TenantOnboardingResponse,
  OnboardingStatusResponse,
} from "@/lib/services/tenant-onboarding-service";

// Mock the service
jest.mock("@/lib/services/tenant-onboarding-service", () => ({
  tenantOnboardingService: {
    onboardTenant: jest.fn(),
    getOnboardingStatus: jest.fn(),
    generateSlug: jest.fn(),
    generatePassword: jest.fn(),
  },
}));

const mockService = tenantOnboardingService.tenantOnboardingService as jest.Mocked<
  typeof tenantOnboardingService.tenantOnboardingService
>;

// Test wrapper with QueryClient
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

// Test data factories
const createMockOnboardingRequest = (
  overrides: Partial<TenantOnboardingRequest> = {},
): TenantOnboardingRequest => ({
  tenant: {
    name: "ACME ISP",
    slug: "acme-isp",
    plan: "premium",
    contact_email: "contact@acme-isp.com",
    contact_phone: "+1234567890",
    billing_email: "billing@acme-isp.com",
    address: "123 Main St",
    city: "New York",
    state: "NY",
    postal_code: "10001",
    country: "US",
  },
  tenant_id: undefined,
  options: {
    apply_default_settings: true,
    mark_onboarding_complete: true,
    activate_tenant: true,
    allow_existing_tenant: false,
  },
  admin_user: {
    username: "admin",
    email: "admin@acme-isp.com",
    password: undefined,
    generate_password: true,
    full_name: "Admin User",
    roles: ["tenant_admin"],
    send_activation_email: true,
  },
  settings: [{ key: "timezone", value: "America/New_York", value_type: "string" }],
  metadata: { source: "platform-admin" },
  invitations: [{ email: "user@acme-isp.com", role: "user", message: undefined }],
  feature_flags: { billing: true, analytics: true },
  ...overrides,
});

const createMockOnboardingResponse = (
  overrides: Partial<TenantOnboardingResponse> = {},
): TenantOnboardingResponse => ({
  tenant: {
    id: "tenant-001",
    name: "ACME ISP",
    slug: "acme-isp",
    plan: "premium",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  } as any,
  created: true,
  onboarding_status: "completed",
  admin_user_id: "user-001",
  admin_user_password: "generated-password-123",
  invitations: [],
  applied_settings: ["timezone"],
  metadata: { source: "platform-admin" },
  feature_flags_updated: true,
  warnings: [],
  logs: ["Tenant created successfully", "Admin user created"],
  ...overrides,
});

const createMockOnboardingStatus = (
  overrides: Partial<OnboardingStatusResponse> = {},
): OnboardingStatusResponse => ({
  tenant_id: "tenant-001",
  status: "completed",
  completed: true,
  metadata: { onboarded_at: "2024-01-01T00:00:00Z" },
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

describe("useTenantOnboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useTenantOnboarding - Mutation", () => {
    it("should onboard a tenant successfully", async () => {
      const mockRequest = createMockOnboardingRequest();
      const mockResponse = createMockOnboardingResponse();

      mockService.onboardTenant.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useTenantOnboarding(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.onboardAsync(mockRequest);

      expect(response).toEqual(mockResponse);
      expect(mockService.onboardTenant).toHaveBeenCalledWith(mockRequest);
    });

    it("should handle onboarding errors", async () => {
      const mockRequest = createMockOnboardingRequest();
      const error = new Error("Failed to onboard tenant");

      mockService.onboardTenant.mockRejectedValue(error);

      const { result } = renderHook(() => useTenantOnboarding(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.onboardAsync(mockRequest)).rejects.toThrow(
        "Failed to onboard tenant",
      );

      await waitFor(() => {
        expect(result.current.onboardingError).toBeTruthy();
      });
    });

    it("should set isOnboarding flag during mutation", async () => {
      const mockRequest = createMockOnboardingRequest();
      const mockResponse = createMockOnboardingResponse();

      mockService.onboardTenant.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockResponse), 100);
          }),
      );

      const { result } = renderHook(() => useTenantOnboarding(), {
        wrapper: createWrapper(),
      });

      result.current.onboard(mockRequest);

      await waitFor(() => {
        expect(result.current.isOnboarding).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isOnboarding).toBe(false);
      });
    });

    it("should invalidate tenant queries on successful onboarding", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const mockRequest = createMockOnboardingRequest();
      const mockResponse = createMockOnboardingResponse();

      mockService.onboardTenant.mockResolvedValue(mockResponse);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useTenantOnboarding(), { wrapper });

      await result.current.onboardAsync(mockRequest);

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["platform-tenants"] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tenants"] });
      });
    });

    it("should reset mutation state", async () => {
      const mockRequest = createMockOnboardingRequest();
      const mockResponse = createMockOnboardingResponse();

      mockService.onboardTenant.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useTenantOnboarding(), {
        wrapper: createWrapper(),
      });

      await result.current.onboardAsync(mockRequest);

      await waitFor(() => {
        expect(result.current.onboardingResult).toEqual(mockResponse);
      });

      act(() => {
        result.current.reset();
      });

      await waitFor(() => {
        expect(result.current.onboardingResult).toBeUndefined();
      });
      expect(result.current.onboardingError).toBeNull();
    });

    it("should handle onboarding with generated password", async () => {
      const mockRequest = createMockOnboardingRequest({
        admin_user: {
          username: "admin",
          email: "admin@example.com",
          password: undefined,
          generate_password: true,
          full_name: "Admin User",
          roles: ["tenant_admin"],
          send_activation_email: true,
        },
      });

      const mockResponse = createMockOnboardingResponse({
        admin_user_password: "auto-generated-password",
      });

      mockService.onboardTenant.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useTenantOnboarding(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.onboardAsync(mockRequest);

      expect(response.admin_user_password).toBe("auto-generated-password");
    });

    it("should handle onboarding existing tenant", async () => {
      const mockRequest = createMockOnboardingRequest({
        tenant: undefined,
        tenant_id: "existing-tenant-001",
        options: {
          apply_default_settings: true,
          mark_onboarding_complete: true,
          activate_tenant: false,
          allow_existing_tenant: true,
        },
      });

      const mockResponse = createMockOnboardingResponse({
        created: false,
        warnings: ["Tenant already exists"],
      });

      mockService.onboardTenant.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useTenantOnboarding(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.onboardAsync(mockRequest);

      expect(response.created).toBe(false);
      expect(response.warnings).toContain("Tenant already exists");
    });
  });

  describe("useOnboardingStatus", () => {
    it("should fetch onboarding status successfully", async () => {
      const mockStatus = createMockOnboardingStatus();

      mockService.getOnboardingStatus.mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useOnboardingStatus("tenant-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockStatus);
      expect(mockService.getOnboardingStatus).toHaveBeenCalledWith("tenant-001");
    });

    it("should not fetch when tenantId is undefined", () => {
      const { result } = renderHook(() => useOnboardingStatus(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockService.getOnboardingStatus).not.toHaveBeenCalled();
    });

    it("should handle errors when fetching status", async () => {
      mockService.getOnboardingStatus.mockRejectedValue(new Error("Status not found"));

      const { result } = renderHook(() => useOnboardingStatus("tenant-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });

    it("should return in-progress status", async () => {
      const mockStatus = createMockOnboardingStatus({
        status: "in_progress",
        completed: false,
      });

      mockService.getOnboardingStatus.mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useOnboardingStatus("tenant-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.completed).toBe(false);
      expect(result.current.data?.status).toBe("in_progress");
    });
  });

  describe("useSlugGeneration", () => {
    it("should provide slug generation function", () => {
      const { result } = renderHook(() => useSlugGeneration());

      expect(result.current.generateSlug).toBe(mockService.generateSlug);
    });

    it("should call service generateSlug method", () => {
      mockService.generateSlug.mockReturnValue("acme-isp");

      const { result } = renderHook(() => useSlugGeneration());

      const slug = result.current.generateSlug("ACME ISP");

      expect(slug).toBe("acme-isp");
      expect(mockService.generateSlug).toHaveBeenCalledWith("ACME ISP");
    });
  });

  describe("usePasswordGeneration", () => {
    it("should provide password generation function", () => {
      const { result } = renderHook(() => usePasswordGeneration());

      expect(result.current.generatePassword).toBe(mockService.generatePassword);
    });

    it("should call service generatePassword method", () => {
      mockService.generatePassword.mockReturnValue("secure-password-123");

      const { result } = renderHook(() => usePasswordGeneration());

      const password = result.current.generatePassword();

      expect(password).toBe("secure-password-123");
      expect(mockService.generatePassword).toHaveBeenCalled();
    });
  });
});
