/**
 * MSW-based Tests for usePartners Hooks
 * Tests partner management ecosystem with realistic API mocking
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  usePartners,
  usePartner,
  useCreatePartner,
  useUpdatePartner,
  useDeletePartner,
  useCheckLicenseQuota,
  useCreatePartnerCustomer,
  useAllocateLicenses,
  useProvisionPartnerTenant,
  useRecordCommission,
  useCompletePartnerOnboarding,
} from "../usePartners";
import {
  seedPartnersData,
  clearPartnersData,
  createMockPartner,
} from "@/__tests__/msw/handlers/partners";
import type {
  Partner,
  PartnerTier,
  CommissionType,
} from "@/__tests__/msw/handlers/partners";

// Mock AppConfigContext
const mockBuildUrl = jest.fn((path: string) => `http://localhost:8000/api/v1${path}`);

jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      baseUrl: "http://localhost:8000",
      prefix: "/api/v1",
      buildUrl: mockBuildUrl,
    },
  }),
}));

// Mock useToast from @dotmac/ui
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("usePartners Hook Tests (MSW)", () => {
  beforeEach(() => {
    clearPartnersData();
    mockBuildUrl.mockClear();
  });

  describe("usePartners - List Partners", () => {
    it("should fetch all partners successfully", async () => {
      const mockPartners = [
        createMockPartner({ id: "partner-1", business_name: "Partner One" }),
        createMockPartner({ id: "partner-2", business_name: "Partner Two" }),
        createMockPartner({ id: "partner-3", business_name: "Partner Three" }),
      ];
      seedPartnersData(mockPartners);

      const { result } = renderHook(() => usePartners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.partners).toHaveLength(3);
      expect(result.current.data?.total).toBe(3);
      expect(result.current.data?.partners[0].business_name).toBe("Partner One");
    });

    it("should filter partners by status", async () => {
      const mockPartners = [
        createMockPartner({ id: "partner-1", status: "active" }),
        createMockPartner({ id: "partner-2", status: "pending" }),
        createMockPartner({ id: "partner-3", status: "active" }),
      ];
      seedPartnersData(mockPartners);

      const { result } = renderHook(() => usePartners("active"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.partners).toHaveLength(2);
      expect(result.current.data?.partners.every((p) => p.status === "active")).toBe(true);
    });

    it("should handle pagination correctly", async () => {
      const mockPartners = Array.from({ length: 15 }, (_, i) =>
        createMockPartner({ id: `partner-${i + 1}`, business_name: `Partner ${i + 1}` })
      );
      seedPartnersData(mockPartners);

      const { result } = renderHook(() => usePartners(undefined, 2, 5), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.partners).toHaveLength(5);
      expect(result.current.data?.page).toBe(2);
      expect(result.current.data?.page_size).toBe(5);
      expect(result.current.data?.total).toBe(15);
    });

    it("should handle all partner statuses", async () => {
      const statuses = ["pending", "active", "suspended", "terminated", "archived"];
      const mockPartners = statuses.map((status, i) =>
        createMockPartner({ id: `partner-${i + 1}`, status: status as any })
      );
      seedPartnersData(mockPartners);

      const { result } = renderHook(() => usePartners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const returnedStatuses = result.current.data?.partners.map((p) => p.status);
      statuses.forEach((status) => {
        expect(returnedStatuses).toContain(status);
      });
    });

    it("should handle all partner tiers", async () => {
      const tiers: PartnerTier[] = ["bronze", "silver", "gold", "platinum", "direct"];
      const mockPartners = tiers.map((tier, i) =>
        createMockPartner({ id: `partner-${i + 1}`, tier })
      );
      seedPartnersData(mockPartners);

      const { result } = renderHook(() => usePartners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const returnedTiers = result.current.data?.partners.map((p) => p.tier);
      tiers.forEach((tier) => {
        expect(returnedTiers).toContain(tier);
      });
    });
  });

  describe("usePartner - Get Single Partner", () => {
    it("should fetch a single partner by ID", async () => {
      const mockPartner = createMockPartner({
        id: "partner-123",
        business_name: "Test Partner",
      });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => usePartner("partner-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.id).toBe("partner-123");
      expect(result.current.data?.business_name).toBe("Test Partner");
    });

    it("should handle partner not found", async () => {
      const { result } = renderHook(() => usePartner("nonexistent"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("should skip fetch when partnerId is undefined", async () => {
      const { result } = renderHook(() => usePartner(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useCreatePartner", () => {
    it("should create a new partner successfully", async () => {
      const { result } = renderHook(() => useCreatePartner(), {
        wrapper: createWrapper(),
      });

      let createdPartner: Partner | undefined;

      await waitFor(async () => {
        createdPartner = await result.current.mutateAsync({
          business_name: "New Partner",
          contact_name: "John Doe",
          email: "john@newpartner.com",
          phone: "+1234567890",
          tier: "gold",
        });
      });

      expect(createdPartner).toBeDefined();
      expect(createdPartner?.business_name).toBe("New Partner");
      expect(createdPartner?.tier).toBe("gold");
      expect(createdPartner?.status).toBe("pending");
    });

    it("should create partner with all fields", async () => {
      const { result } = renderHook(() => useCreatePartner(), {
        wrapper: createWrapper(),
      });

      let createdPartner: Partner | undefined;

      await waitFor(async () => {
        createdPartner = await result.current.mutateAsync({
          business_name: "Full Partner",
          contact_name: "Jane Smith",
          email: "jane@fullpartner.com",
          phone: "+9876543210",
          tier: "platinum",
          address: "123 Main St",
          city: "New York",
          state: "NY",
          postal_code: "10001",
          country: "USA",
          license_quota: 100,
          commission_rate: 0.20,
        });
      });

      expect(createdPartner).toBeDefined();
      expect(createdPartner?.business_name).toBe("Full Partner");
      expect(createdPartner?.license_quota).toBe(100);
      expect(createdPartner?.commission_rate).toBe(0.20);
    });
  });

  describe("useUpdatePartner", () => {
    it("should update partner successfully", async () => {
      const mockPartner = createMockPartner({
        id: "partner-123",
        business_name: "Old Name",
        status: "pending",
      });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => useUpdatePartner(), {
        wrapper: createWrapper(),
      });

      let updatedPartner: Partner | undefined;

      await waitFor(async () => {
        updatedPartner = await result.current.mutateAsync({
          partnerId: "partner-123",
          data: {
            business_name: "Updated Name",
            status: "active",
          },
        });
      });

      expect(updatedPartner).toBeDefined();
      expect(updatedPartner?.business_name).toBe("Updated Name");
      expect(updatedPartner?.status).toBe("active");
    });

    it("should handle partner not found", async () => {
      const { result } = renderHook(() => useUpdatePartner(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          partnerId: "nonexistent",
          data: { business_name: "New Name" },
        })
      ).rejects.toThrow();
    });
  });

  describe("useDeletePartner", () => {
    it("should delete partner successfully", async () => {
      const mockPartner = createMockPartner({ id: "partner-123" });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => useDeletePartner(), {
        wrapper: createWrapper(),
      });

      await waitFor(async () => {
        await result.current.mutateAsync("partner-123");
      });

      expect(result.current.isSuccess).toBe(true);
    });

    it("should handle deleting nonexistent partner", async () => {
      const { result } = renderHook(() => useDeletePartner(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync("nonexistent")).rejects.toThrow();
    });
  });

  describe("useCheckLicenseQuota", () => {
    it("should check license quota successfully when quota available", async () => {
      const mockPartner = createMockPartner({
        id: "partner-123",
        license_quota: 100,
        licenses_allocated: 30,
      });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => useCheckLicenseQuota(), {
        wrapper: createWrapper(),
      });

      let quotaCheck: any;

      await waitFor(async () => {
        quotaCheck = await result.current.mutateAsync({
          partnerId: "partner-123",
          requestedLicenses: 50,
        });
      });

      expect(quotaCheck).toBeDefined();
      expect(quotaCheck.available).toBe(true);
      expect(quotaCheck.can_allocate).toBe(true);
      expect(quotaCheck.quota_remaining).toBe(70);
    });

    it("should check license quota when quota exceeded", async () => {
      const mockPartner = createMockPartner({
        id: "partner-123",
        license_quota: 100,
        licenses_allocated: 80,
      });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => useCheckLicenseQuota(), {
        wrapper: createWrapper(),
      });

      let quotaCheck: any;

      await waitFor(async () => {
        quotaCheck = await result.current.mutateAsync({
          partnerId: "partner-123",
          requestedLicenses: 30,
        });
      });

      expect(quotaCheck.available).toBe(false);
      expect(quotaCheck.can_allocate).toBe(false);
      expect(quotaCheck.quota_remaining).toBe(20);
    });

    it("should handle edge case with exact quota match", async () => {
      const mockPartner = createMockPartner({
        id: "partner-123",
        license_quota: 100,
        licenses_allocated: 50,
      });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => useCheckLicenseQuota(), {
        wrapper: createWrapper(),
      });

      let quotaCheck: any;

      await waitFor(async () => {
        quotaCheck = await result.current.mutateAsync({
          partnerId: "partner-123",
          requestedLicenses: 50,
        });
      });

      expect(quotaCheck.available).toBe(true);
      expect(quotaCheck.can_allocate).toBe(true);
      expect(quotaCheck.quota_remaining).toBe(50);
    });
  });

  describe("useCreatePartnerCustomer", () => {
    it("should create partner customer successfully", async () => {
      const mockPartner = createMockPartner({ id: "partner-123" });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => useCreatePartnerCustomer(), {
        wrapper: createWrapper(),
      });

      let customer: any;

      await waitFor(async () => {
        customer = await result.current.mutateAsync({
          partnerId: "partner-123",
          customerData: {
            first_name: "Customer",
            last_name: "Corp",
            email: "contact@customer.com",
            phone: "+1234567890",
            company_name: "Customer Corp",
          },
        });
      });

      expect(customer).toBeDefined();
      expect(customer.name).toBe("Customer Corp");
      expect(customer.partner_id).toBe("partner-123");
      expect(customer.status).toBe("active");
    });

    it("should handle partner not found when creating customer", async () => {
      const { result } = renderHook(() => useCreatePartnerCustomer(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          partnerId: "nonexistent",
          customerData: { first_name: "Test", last_name: "Customer", email: "test@example.com" },
        })
      ).rejects.toThrow();
    });
  });

  describe("useAllocateLicenses", () => {
    it("should allocate licenses successfully", async () => {
      const mockPartner = createMockPartner({
        id: "partner-123",
        license_quota: 100,
        licenses_allocated: 30,
      });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => useAllocateLicenses(), {
        wrapper: createWrapper(),
      });

      let allocation: any;

      await waitFor(async () => {
        allocation = await result.current.mutateAsync({
          partner_id: "partner-123",
          customer_id: "customer-456",
          license_template_id: "template-1",
          license_count: 20,
        });
      });

      expect(allocation).toBeDefined();
      expect(allocation.licenses_allocated).toBe(20);
    });

    it("should handle quota exceeded when allocating licenses", async () => {
      const mockPartner = createMockPartner({
        id: "partner-123",
        license_quota: 100,
        licenses_allocated: 90,
      });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => useAllocateLicenses(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          partner_id: "partner-123",
          customer_id: "customer-456",
          license_template_id: "template-1",
          license_count: 20,
        })
      ).rejects.toThrow();
    });
  });

  describe("useProvisionPartnerTenant", () => {
    it("should provision tenant without white-label config", async () => {
      const mockPartner = createMockPartner({ id: "partner-123" });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => useProvisionPartnerTenant(), {
        wrapper: createWrapper(),
      });

      let tenant: any;

      await waitFor(async () => {
        tenant = await result.current.mutateAsync({
          partner_id: "partner-123",
          customer_id: "customer-456",
          license_key: "key-123",
          deployment_type: "cloud",
        });
      });

      expect(tenant).toBeDefined();
      expect(tenant.tenant_url).toMatch(/^https:\/\/tenant\d+\.example\.com$/);
      expect(tenant.white_label_applied).toBe(false);
    });

    it("should provision tenant with white-label config", async () => {
      const mockPartner = createMockPartner({ id: "partner-123" });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => useProvisionPartnerTenant(), {
        wrapper: createWrapper(),
      });

      let tenant: any;

      await waitFor(async () => {
        tenant = await result.current.mutateAsync({
          partner_id: "partner-123",
          customer_id: "customer-456",
          license_key: "key-123",
          deployment_type: "cloud",
          white_label_config: {
            custom_domain: "custom.example.com",
            company_name: "Custom Brand",
            logo_url: "https://example.com/logo.png",
            primary_color: "#007bff",
            secondary_color: "#6c757d",
          },
        });
      });

      expect(tenant).toBeDefined();
      expect(tenant.tenant_url).toBe("https://custom.example.com");
      expect(tenant.white_label_applied).toBe(true);
      expect(tenant.white_label_config?.company_name).toBe("Custom Brand");
      expect(tenant.white_label_config?.primary_color).toBe("#007bff");
    });

    it("should handle partner not found when provisioning tenant", async () => {
      const { result } = renderHook(() => useProvisionPartnerTenant(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          partner_id: "nonexistent",
          customer_id: "customer-456",
          license_key: "key-123",
          deployment_type: "cloud",
        })
      ).rejects.toThrow();
    });
  });

  describe("useRecordCommission", () => {
    it("should record new_customer commission", async () => {
      const mockPartner = createMockPartner({ id: "partner-123" });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => useRecordCommission(), {
        wrapper: createWrapper(),
      });

      let commission: any;

      await waitFor(async () => {
        commission = await result.current.mutateAsync({
          partner_id: "partner-123",
          customer_id: "customer-456",
          commission_type: "new_customer",
          amount: 500.0,
        });
      });

      expect(commission).toBeDefined();
      expect(commission.commission_type).toBe("new_customer");
      expect(commission.amount).toBe(500.0);
      expect(commission.status).toBe("pending");
    });

    it("should record all commission types", async () => {
      const mockPartner = createMockPartner({ id: "partner-123" });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => useRecordCommission(), {
        wrapper: createWrapper(),
      });

      const commissionTypes: CommissionType[] = [
        "new_customer",
        "renewal",
        "upgrade",
        "usage",
        "referral",
      ];

      for (const type of commissionTypes) {
        let commission: any;

        await waitFor(async () => {
          commission = await result.current.mutateAsync({
            partner_id: "partner-123",
            customer_id: "customer-456",
            commission_type: type,
            amount: 100.0,
          });
        });

        expect(commission.commission_type).toBe(type);
      }
    });
  });

  describe("useCompletePartnerOnboarding", () => {
    it("should complete onboarding workflow without white-label", async () => {
      const { result } = renderHook(() => useCompletePartnerOnboarding(), {
        wrapper: createWrapper(),
      });

      let onboardingResult: any;

      await waitFor(async () => {
        onboardingResult = await result.current.mutateAsync({
          partner_data: {
            business_name: "New Partner",
            contact_name: "John Doe",
            email: "john@newpartner.com",
            phone: "+1234567890",
            tier: "gold",
          },
          customer_data: {
            first_name: "First",
            last_name: "Customer",
            email: "customer@example.com",
            phone: "+9876543210",
          },
          license_template_id: "template-1",
          deployment_type: "cloud",
        });
      });

      expect(onboardingResult).toBeDefined();
      expect(onboardingResult.partner).toBeDefined();
      expect(onboardingResult.customer).toBeDefined();
      expect(onboardingResult.licenses).toBeDefined();
      expect(onboardingResult.tenant).toBeDefined();
      expect(onboardingResult.status).toBe("completed");

      expect(onboardingResult.partner.business_name).toBe("New Partner");
      expect(onboardingResult.customer.name).toBe("First Customer");
      expect(onboardingResult.tenant.white_label_applied).toBe(false);
    });

    it("should complete onboarding workflow with white-label config", async () => {
      const { result } = renderHook(() => useCompletePartnerOnboarding(), {
        wrapper: createWrapper(),
      });

      let onboardingResult: any;

      await waitFor(async () => {
        onboardingResult = await result.current.mutateAsync({
          partner_data: {
            business_name: "Premium Partner",
            contact_name: "Jane Smith",
            email: "jane@premium.com",
            phone: "+1234567890",
            tier: "platinum",
          },
          customer_data: {
            first_name: "Enterprise",
            last_name: "Customer",
            email: "enterprise@customer.com",
            phone: "+9876543210",
          },
          license_template_id: "template-1",
          deployment_type: "cloud",
          white_label_config: {
            custom_domain: "branded.example.com",
            company_name: "Branded Solution",
            logo_url: "https://example.com/brand-logo.png",
            primary_color: "#ff6600",
            secondary_color: "#0066ff",
          },
        });
      });

      expect(onboardingResult).toBeDefined();
      expect(onboardingResult.status).toBe("completed");
      expect(onboardingResult.partner.tier).toBe("platinum");
      expect(onboardingResult.customer.name).toBe("Enterprise Customer");
      expect(onboardingResult.tenant.white_label_applied).toBe(true);
      expect(onboardingResult.tenant.tenant_url).toBe("https://branded.example.com");
      expect(onboardingResult.tenant.white_label_config?.company_name).toBe("Branded Solution");
      expect(onboardingResult.tenant.white_label_config?.primary_color).toBe("#ff6600");
    });

    it("should return workflow_id for tracking", async () => {
      const { result } = renderHook(() => useCompletePartnerOnboarding(), {
        wrapper: createWrapper(),
      });

      let onboardingResult: any;

      await waitFor(async () => {
        onboardingResult = await result.current.mutateAsync({
          partner_data: {
            business_name: "Tracked Partner",
            contact_name: "Tracker",
            email: "track@partner.com",
            phone: "+1234567890",
            tier: "silver",
          },
          customer_data: {
            first_name: "Tracked",
            last_name: "Customer",
            email: "customer@tracked.com",
          },
          license_template_id: "template-1",
          deployment_type: "cloud",
        });
      });

      expect(onboardingResult.workflow_id).toBeDefined();
      expect(onboardingResult.workflow_id).toMatch(/^wf-\d+$/);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty partner list", async () => {
      clearPartnersData();

      const { result } = renderHook(() => usePartners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.partners).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle large partner dataset with pagination", async () => {
      const mockPartners = Array.from({ length: 100 }, (_, i) =>
        createMockPartner({ id: `partner-${i + 1}` })
      );
      seedPartnersData(mockPartners);

      const { result } = renderHook(() => usePartners(undefined, 1, 50), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.partners).toHaveLength(50);
      expect(result.current.data?.total).toBe(100);
    });

    it("should handle partner with all optional fields populated", async () => {
      const mockPartner = createMockPartner({
        id: "partner-full",
        business_name: "Full Partner",
        contact_name: "Full Contact",
        email: "full@partner.com",
        phone: "+1234567890",
        tier: "platinum",
        status: "active",
        address: "123 Full St",
        city: "Full City",
        state: "FC",
        postal_code: "12345",
        country: "USA",
        license_quota: 1000,
        licenses_allocated: 500,
        commission_rate: 0.25,
      });
      seedPartnersData([mockPartner]);

      const { result } = renderHook(() => usePartner("partner-full"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const partner = result.current.data;
      expect(partner?.business_name).toBe("Full Partner");
      expect(partner?.address).toBe("123 Full St");
      expect(partner?.city).toBe("Full City");
      expect(partner?.license_quota).toBe(1000);
      expect(partner?.commission_rate).toBe(0.25);
    });
  });
});
