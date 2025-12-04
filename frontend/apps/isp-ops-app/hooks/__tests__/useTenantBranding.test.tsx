/**
 * Jest Tests for useTenantBranding Hooks
 *
 * Tests tenant branding configuration query and mutation hooks with Jest mocks.
 * Covers fetching and updating branding configuration.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useTenantBrandingQuery,
  useUpdateTenantBranding,
  type TenantBrandingConfigDto,
  type TenantBrandingResponseDto,
} from "../useTenantBranding";
import { apiClient } from "@/lib/api/client";
import * as sharedAuth from "@shared/lib/auth";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@shared/lib/auth", () => ({
  useSession: jest.fn(),
  isAuthBypassEnabled: jest.fn(() => false),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockUseSession = sharedAuth.useSession as jest.MockedFunction<typeof sharedAuth.useSession>;

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
const createMockBrandingConfig = (
  overrides: Partial<TenantBrandingConfigDto> = {},
): TenantBrandingConfigDto => ({
  product_name: "ISP Platform",
  product_tagline: "Your Network Management Solution",
  company_name: "ACME ISP",
  support_email: "support@acme-isp.com",
  success_email: "success@acme-isp.com",
  operations_email: "ops@acme-isp.com",
  partner_support_email: "partners@acme-isp.com",
  primary_color: "#0066CC",
  secondary_color: "#00AA66",
  accent_color: "#FF6600",
  logo_light_url: "https://example.com/logo-light.png",
  logo_dark_url: "https://example.com/logo-dark.png",
  favicon_url: "https://example.com/favicon.ico",
  docs_url: "https://docs.acme-isp.com",
  support_portal_url: "https://support.acme-isp.com",
  status_page_url: "https://status.acme-isp.com",
  terms_url: "https://acme-isp.com/terms",
  privacy_url: "https://acme-isp.com/privacy",
  ...overrides,
});

const createMockBrandingResponse = (
  overrides: Partial<TenantBrandingResponseDto> = {},
): TenantBrandingResponseDto => ({
  tenant_id: "tenant-001",
  branding: createMockBrandingConfig(),
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const createMockUser = (tenantId?: string) => ({
  id: "user-001",
  tenant_id: tenantId || "tenant-001",
  email: "user@example.com",
  username: "testuser",
  full_name: "Test User",
  roles: ["user"],
  permissions: [],
  is_active: true,
  is_platform_admin: false,
  mfa_enabled: false,
  activeOrganization: null,
});

describe("useTenantBranding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useTenantBrandingQuery", () => {
    it("should fetch tenant branding configuration successfully", async () => {
      const mockBranding = createMockBrandingResponse();

      mockUseSession.mockReturnValue({
        user: createMockUser(),
        isLoading: false,
        isAuthenticated: true,
      } as any);

      mockApiClient.get.mockResolvedValue({
        data: mockBranding,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useTenantBrandingQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockBranding);
      expect(mockApiClient.get).toHaveBeenCalledWith("/branding");
    });

    it("should not fetch when user has no tenant_id", () => {
      mockUseSession.mockReturnValue({
        user: {
          id: "user-001",
          email: "user@example.com",
          username: "testuser",
          full_name: "Test User",
          roles: ["user"],
          permissions: [],
          is_active: true,
          is_platform_admin: false,
          mfa_enabled: false,
          activeOrganization: null,
          tenant_id: null,
        },
        isLoading: false,
        isAuthenticated: true,
      } as any);

      const { result } = renderHook(() => useTenantBrandingQuery(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it("should not fetch when session is not available", () => {
      mockUseSession.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      } as any);

      const { result } = renderHook(() => useTenantBrandingQuery(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it("should handle errors when fetching branding", async () => {
      mockUseSession.mockReturnValue({
        user: createMockUser(),
        isLoading: false,
        isAuthenticated: true,
      } as any);

      mockApiClient.get.mockRejectedValue(new Error("Failed to load branding configuration"));

      const { result } = renderHook(() => useTenantBrandingQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });

    it("should handle partial branding configuration", async () => {
      const mockBranding = createMockBrandingResponse({
        branding: {
          product_name: "Custom ISP",
          primary_color: "#FF0000",
        },
      });

      mockUseSession.mockReturnValue({
        user: createMockUser(),
        isLoading: false,
        isAuthenticated: true,
      } as any);

      mockApiClient.get.mockResolvedValue({
        data: mockBranding,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useTenantBrandingQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.branding.product_name).toBe("Custom ISP");
      expect(result.current.data?.branding.primary_color).toBe("#FF0000");
    });
  });

  describe("useUpdateTenantBranding", () => {
    it("should update tenant branding successfully", async () => {
      const updatedBranding = createMockBrandingConfig({
        product_name: "Updated ISP Platform",
        primary_color: "#00FF00",
      });

      const mockResponse = createMockBrandingResponse({
        branding: updatedBranding,
        updated_at: "2024-01-02T00:00:00Z",
      });

      mockApiClient.put.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useUpdateTenantBranding(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync(updatedBranding);

      expect(response).toEqual(mockResponse);
      expect(mockApiClient.put).toHaveBeenCalledWith("/branding", {
        branding: updatedBranding,
      });
    });

    it("should invalidate query cache on successful update", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const updatedBranding = createMockBrandingConfig();
      const mockResponse = createMockBrandingResponse({ branding: updatedBranding });

      mockApiClient.put.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useUpdateTenantBranding(), { wrapper });

      await result.current.mutateAsync(updatedBranding);

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tenant-branding"] });
      });
    });

    it("should handle errors when updating branding", async () => {
      mockApiClient.put.mockRejectedValue(new Error("Failed to update branding configuration"));

      const { result } = renderHook(() => useUpdateTenantBranding(), {
        wrapper: createWrapper(),
      });

      const updatedBranding = createMockBrandingConfig();

      await expect(result.current.mutateAsync(updatedBranding)).rejects.toThrow(
        "Failed to update branding configuration",
      );
    });

    it("should call custom onSuccess callback", async () => {
      const updatedBranding = createMockBrandingConfig();
      const mockResponse = createMockBrandingResponse({ branding: updatedBranding });
      const onSuccess = jest.fn();

      mockApiClient.put.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useUpdateTenantBranding({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync(updatedBranding);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });

      // Verify the response shape
      const [response, variables] = onSuccess.mock.calls[0];
      expect(response.tenant_id).toBe(mockResponse.tenant_id);
      expect(response.branding).toBeDefined();
      expect(variables).toEqual(updatedBranding);
    });

    it("should update only specific branding fields", async () => {
      const partialUpdate: TenantBrandingConfigDto = {
        primary_color: "#123456",
      };

      const mockResponse = createMockBrandingResponse({
        branding: { ...createMockBrandingConfig(), ...partialUpdate },
      });

      mockApiClient.put.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useUpdateTenantBranding(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync(partialUpdate);

      expect(mockApiClient.put).toHaveBeenCalledWith("/branding", {
        branding: partialUpdate,
      });
      expect(response.branding.primary_color).toBe("#123456");
    });

    it("should handle validation errors", async () => {
      mockApiClient.put.mockRejectedValue({
        response: {
          data: {
            error: "Validation failed",
            details: { primary_color: "Invalid color format" },
          },
        },
      });

      const { result } = renderHook(() => useUpdateTenantBranding(), {
        wrapper: createWrapper(),
      });

      const invalidBranding = createMockBrandingConfig({
        primary_color: "invalid-color",
      });

      await expect(result.current.mutateAsync(invalidBranding)).rejects.toBeTruthy();
    });
  });
});
