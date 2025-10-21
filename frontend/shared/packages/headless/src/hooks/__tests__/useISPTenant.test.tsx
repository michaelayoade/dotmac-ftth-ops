/**
 * useISPTenant Hook Tests
 * Comprehensive test suite for the refactored ISP tenant management hook
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { useISPTenant } from "../useISPTenant";
import { ISPTenantProvider, ISPTenantContext } from "../useISPTenant";
import type { ISPTenant, TenantUser, TenantSession } from "../../types/tenant";

// Mock API client
const mockISPClient = {
  identity: {
    getCurrentUser: jest.fn(),
    getTenant: jest.fn(),
    updateTenantSettings: jest.fn(),
  },
  networking: {
    getDevices: jest.fn(),
  },
  billing: {
    getInvoices: jest.fn(),
  },
};

// Mock data
const mockTenant: ISPTenant = {
  id: "tenant_123",
  name: "Test ISP Corp",
  slug: "test-isp",
  status: "ACTIVE",
  subscription: {
    plan: "PROFESSIONAL",
    status: "ACTIVE",
    current_period_start: "2024-01-01T00:00:00Z",
    current_period_end: "2024-12-31T23:59:59Z",
    billing_cycle: "MONTHLY",
    max_customers: 10000,
    max_services: 50000,
    max_users: 100,
  },
  isp_config: {
    company_name: "Test ISP Corp",
    company_type: "FIBER",
    service_area: "Metropolitan Area",
    time_zone: "America/New_York",
    currency: "USD",
    locale: "en-US",
    network: {
      default_dns: ["8.8.8.8", "8.8.4.4"],
    },
    portals: {
      customer_portal: {
        enabled: true,
        features: ["billing", "support", "usage"],
      },
      reseller_portal: {
        enabled: true,
        commission_structure: "PERCENTAGE",
      },
      technician_portal: {
        enabled: true,
        mobile_app_enabled: true,
        gps_tracking: true,
      },
    },
  },
  branding: {
    primary_color: "#0066cc",
    secondary_color: "#f0f8ff",
    accent_color: "#ff6600",
    white_label: false,
    email_templates: {},
  },
  features: {
    identity: true,
    billing: true,
    services: true,
    networking: true,
    support: true,
    sales: false,
    resellers: true,
    analytics: true,
    inventory: false,
    field_ops: false,
    compliance: false,
    notifications: true,
    advanced_reporting: false,
    api_access: true,
    white_labeling: false,
    custom_integrations: false,
    sla_management: false,
    multi_language: false,
  },
  limits: {
    customers: 10000,
    services: 50000,
    users: 100,
    api_requests_per_hour: 10000,
    storage_gb: 100,
    bandwidth_gb: 1000,
  },
  usage: {
    customers: 2500,
    services: 12000,
    users: 25,
    api_requests_this_hour: 150,
    storage_used_gb: 45,
    bandwidth_used_gb: 280,
  },
  contact: {
    primary_contact: {
      name: "John Smith",
      email: "john@testisp.com",
      phone: "+1-555-0123",
      role: "CEO",
    },
    address: {
      street: "123 ISP Street",
      city: "Tech City",
      state: "CA",
      zip_code: "94105",
      country: "US",
    },
  },
  integrations: {},
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2024-01-15T10:30:00Z",
  created_by: "admin",
};

const mockUser: TenantUser = {
  id: "user_456",
  email: "test@testisp.com",
  name: "Test User",
  role: "ADMIN",
  permissions: ["admin.settings.read", "admin.settings.write", "billing.invoices.read"],
  status: "ACTIVE",
  created_at: "2023-06-01T00:00:00Z",
  updated_at: "2024-01-10T09:15:00Z",
};

const mockSession: TenantSession = {
  tenant: mockTenant,
  user: mockUser,
  portal_type: "ADMIN",
  permissions: mockUser.permissions,
  features: ["identity", "billing", "services", "networking", "support"],
  limits: {
    customers: 10000,
    services: 50000,
    users: 100,
  },
  branding: {
    primary_color: "#0066cc",
    secondary_color: "#f0f8ff",
    company_name: "Test ISP Corp",
    white_label: false,
  },
};

// Test wrapper component
const TestWrapper = ({ children }: { children: ReactNode }) => (
  <ISPTenantProvider apiClient={mockISPClient as any}>{children}</ISPTenantProvider>
);

describe("useISPTenant Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock responses
    mockISPClient.identity.getCurrentUser.mockResolvedValue({ data: mockUser });
    mockISPClient.identity.getTenant.mockResolvedValue({ data: mockTenant });
  });

  describe("Hook Initialization", () => {
    it("should throw error when used outside provider", () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useISPTenant());
      }).toThrow("useISPTenant must be used within an ISPTenantProvider");

      consoleError.mockRestore();
    });

    it("should initialize with loading state", () => {
      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.session).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("should load session data on mount", async () => {
      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.session).toEqual(mockSession);
      expect(result.current.error).toBeNull();
      expect(mockISPClient.identity.getCurrentUser).toHaveBeenCalledTimes(1);
      expect(mockISPClient.identity.getTenant).toHaveBeenCalledTimes(1);
    });
  });

  describe("Permission Management", () => {
    it("should check permissions correctly", async () => {
      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasPermission("admin.settings.read")).toBe(true);
      expect(result.current.hasPermission("admin.settings.write")).toBe(true);
      expect(result.current.hasPermission("billing.invoices.read")).toBe(true);
      expect(result.current.hasPermission("services.provision")).toBe(false);
    });

    it("should check multiple permissions with AND logic", async () => {
      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasPermissions(["admin.settings.read", "billing.invoices.read"])).toBe(
        true,
      );
      expect(result.current.hasPermissions(["admin.settings.read", "services.provision"])).toBe(
        false,
      );
    });

    it("should check role-based permissions", async () => {
      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasRole("ADMIN")).toBe(true);
      expect(result.current.hasRole("VIEWER")).toBe(false);
    });
  });

  describe("Feature Management", () => {
    it("should check feature availability", async () => {
      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasFeature("billing")).toBe(true);
      expect(result.current.hasFeature("analytics")).toBe(true);
      expect(result.current.hasFeature("sales")).toBe(false);
      expect(result.current.hasFeature("field_ops")).toBe(false);
    });

    it("should get enabled features list", async () => {
      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const enabledFeatures = result.current.getEnabledFeatures();
      expect(enabledFeatures).toContain("identity");
      expect(enabledFeatures).toContain("billing");
      expect(enabledFeatures).toContain("services");
      expect(enabledFeatures).toContain("networking");
      expect(enabledFeatures).not.toContain("sales");
      expect(enabledFeatures).not.toContain("field_ops");
    });
  });

  describe("Limits & Usage Management", () => {
    it("should calculate usage percentages correctly", async () => {
      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const usagePercentages = result.current.getUsagePercentages();
      expect(usagePercentages.customers).toBe(25); // 2500/10000 * 100
      expect(usagePercentages.services).toBe(24); // 12000/50000 * 100
      expect(usagePercentages.users).toBe(25); // 25/100 * 100
      expect(usagePercentages.storage).toBe(45); // 45/100 * 100
    });

    it("should check if usage is approaching limits", async () => {
      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isApproachingLimit("customers")).toBe(false); // 25% usage
      expect(result.current.isApproachingLimit("storage")).toBe(false); // 45% usage

      // Test with custom threshold
      expect(result.current.isApproachingLimit("storage", 40)).toBe(true); // 45% > 40%
    });

    it("should check if limit is exceeded", async () => {
      // Create mock data with exceeded limits
      const exceededUsageTenant = {
        ...mockTenant,
        usage: {
          ...mockTenant.usage,
          customers: 15000, // Exceeds limit of 10000
        },
      };

      mockISPClient.identity.getTenant.mockResolvedValueOnce({
        data: exceededUsageTenant,
      });

      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLimitExceeded("customers")).toBe(true);
      expect(result.current.isLimitExceeded("services")).toBe(false);
    });
  });

  describe("Settings Management", () => {
    it("should update tenant settings", async () => {
      mockISPClient.identity.updateTenantSettings.mockResolvedValue({
        data: {
          ...mockTenant,
          isp_config: {
            ...mockTenant.isp_config,
            time_zone: "America/Los_Angeles",
          },
        },
      });

      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateSettings({
          isp_config: {
            ...mockTenant.isp_config,
            time_zone: "America/Los_Angeles",
          },
        });
      });

      expect(mockISPClient.identity.updateTenantSettings).toHaveBeenCalledWith(
        mockTenant.id,
        expect.objectContaining({
          isp_config: expect.objectContaining({
            time_zone: "America/Los_Angeles",
          }),
        }),
      );
    });

    it("should handle settings update errors", async () => {
      const updateError = new Error("Update failed");
      mockISPClient.identity.updateTenantSettings.mockRejectedValue(updateError);

      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await expect(result.current.updateSettings({ name: "New Name" })).rejects.toThrow(
          "Update failed",
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors during initialization", async () => {
      const apiError = new Error("API Error");
      mockISPClient.identity.getCurrentUser.mockRejectedValue(apiError);

      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("API Error");
      expect(result.current.session).toBeNull();
    });

    it("should handle tenant fetch errors", async () => {
      mockISPClient.identity.getTenant.mockRejectedValue(new Error("Tenant not found"));

      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("Tenant not found");
    });
  });

  describe("Refresh Functionality", () => {
    it("should refresh session data", async () => {
      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear previous calls
      jest.clearAllMocks();

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(mockISPClient.identity.getCurrentUser).toHaveBeenCalledTimes(1);
      expect(mockISPClient.identity.getTenant).toHaveBeenCalledTimes(1);
    });
  });

  describe("Portal Type Management", () => {
    it("should return correct portal type", async () => {
      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.session?.portal_type).toBe("ADMIN");
    });
  });

  describe("Branding Information", () => {
    it("should provide branding information", async () => {
      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const branding = result.current.getBranding();
      expect(branding.primary_color).toBe("#0066cc");
      expect(branding.company_name).toBe("Test ISP Corp");
      expect(branding.white_label).toBe(false);
    });
  });

  describe("Subscription Management", () => {
    it("should check subscription status", async () => {
      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSubscriptionActive()).toBe(true);
    });

    it("should handle expired subscription", async () => {
      const expiredTenant = {
        ...mockTenant,
        subscription: {
          ...mockTenant.subscription,
          status: "PAST_DUE" as const,
        },
      };

      mockISPClient.identity.getTenant.mockResolvedValueOnce({
        data: expiredTenant,
      });

      const { result } = renderHook(() => useISPTenant(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSubscriptionActive()).toBe(false);
    });
  });
});
