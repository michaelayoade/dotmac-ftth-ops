/**
 * useISPTenant Hook Tests
 * Focused on provider usage and branding access
 */

import { renderHook, waitFor } from "@testing-library/react";
import React, { ReactNode } from "react";

import type { ISPTenant, TenantSession, TenantUser } from "../../types/tenant";
import { ISPTenantContext, createISPTenantContextValue, useISPTenant } from "../useISPTenant";

// Mock dependencies used by ISPTenantProvider
jest.mock("../usePortalIdAuth", () => ({
  usePortalIdAuth: () => ({
    isAuthenticated: true,
    portalAccount: null,
    customerData: null,
    technicianData: null,
    resellerData: null,
  }),
}));

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

jest.mock("../tenant/useTenantSession", () => ({
  useTenantSession: () => ({
    session: null,
    isLoading: false,
    error: null,
    loadTenant: jest.fn(),
    switchTenant: jest.fn(),
    refreshTenant: jest.fn(),
    clearTenant: jest.fn(),
  }),
}));

jest.mock("../tenant/useTenantPermissions", () => ({
  useTenantPermissions: () => ({
    hasPermission: jest.fn().mockReturnValue(true),
    hasAnyPermission: jest.fn().mockReturnValue(true),
    hasAllPermissions: jest.fn().mockReturnValue(true),
    hasFeature: jest.fn().mockReturnValue(true),
    hasModule: jest.fn().mockReturnValue(true),
  }),
}));

jest.mock("../tenant/useTenantLimits", () => ({
  useTenantLimits: () => ({
    getLimitsUsage: jest.fn().mockReturnValue({
      customers: { current: 2500, limit: 10000, percentage: 25 },
      services: { current: 12000, limit: 50000, percentage: 24 },
      users: { current: 25, limit: 100, percentage: 25 },
    }),
    isLimitReached: jest.fn().mockReturnValue(false),
    getUsagePercentage: jest.fn().mockReturnValue(25),
    isTrialExpiring: jest.fn().mockReturnValue(false),
    getTrialDaysLeft: jest.fn().mockReturnValue(30),
    isTenantActive: jest.fn().mockReturnValue(true),
  }),
}));

jest.mock("../tenant/useTenantSettings", () => ({
  useTenantSettings: () => ({
    getTenantSetting: jest.fn().mockReturnValue("default"),
    updateTenantSetting: jest.fn(),
    getBranding: jest.fn().mockReturnValue({
      primary_color: "#0066cc",
      secondary_color: "#f0f8ff",
      company_name: "Test ISP Corp",
      white_label: false,
    }),
    applyBranding: jest.fn(),
  }),
}));

jest.mock("../tenant/useTenantNotifications", () => ({
  useTenantNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    dismissNotification: jest.fn(),
    addNotification: jest.fn(),
  }),
}));

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
  },
  modules: {
    billing: {
      enabled: true,
      payment_gateway: "stripe",
      currency: "USD",
      retry_policy: {
        max_attempts: 3,
        delay: 300,
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

const TestWrapper = ({ children }: { children: ReactNode }) => {
  const contextValue = createISPTenantContextValue();
  return (
    <ISPTenantContext.Provider value={contextValue}>{children}</ISPTenantContext.Provider>
  );
};

describe("useISPTenant Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
}
);
