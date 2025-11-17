/**
 * MSW Tests for usePartners hook
 * Tests partner management system with realistic API mocking
 */

// Mock platformConfig to provide a base URL for MSW to intercept
jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      timeout: 30000,
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
      graphqlEndpoint: "http://localhost:3000/api/v1/graphql",
    },
  },
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryWrapper } from "@/__tests__/test-utils";
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
  seedPartners,
  clearPartnersData,
} from "@/__tests__/msw/handlers/partners";

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe("usePartners", () => {
  beforeEach(() => {
    clearPartnersData();
  });

  describe("Partner Management", () => {
    describe("usePartners", () => {
      it("should fetch partners successfully", async () => {
        seedPartners([
          {
            id: "partner-1",
            company_name: "Partner One",
            status: "active",
          },
          {
            id: "partner-2",
            company_name: "Partner Two",
            status: "active",
          },
        ]);

        const { result } = renderHook(() => usePartners(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.partners).toHaveLength(2);
        expect(result.current.data?.total).toBe(2);
      });

      it("should filter partners by status", async () => {
        seedPartners([
          { status: "active" },
          { status: "pending" },
          { status: "active" },
        ]);

        const { result } = renderHook(() => usePartners("active"), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.partners).toHaveLength(2);
      });

      it("should support pagination", async () => {
        seedPartners(
          Array.from({ length: 25 }, (_, i) => ({
            id: `partner-${i + 1}`,
            company_name: `Partner ${i + 1}`,
          }))
        );

        const { result } = renderHook(() => usePartners(undefined, 1, 10), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.partners).toHaveLength(10);
        expect(result.current.data?.total).toBe(25);
      });
    });

    describe("usePartner", () => {
      it("should fetch single partner successfully", async () => {
        seedPartners([
          {
            id: "partner-123",
            company_name: "Test Partner",
            primary_email: "test@partner.com",
          },
        ]);

        const { result } = renderHook(() => usePartner("partner-123"), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.id).toBe("partner-123");
        expect(result.current.data?.company_name).toBe("Test Partner");
      });

      it("should not fetch when id is undefined", () => {
        const { result } = renderHook(() => usePartner(undefined), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.fetchStatus).toBe("idle");
      });
    });

    describe("useCreatePartner", () => {
      it("should create partner successfully", async () => {
        const { result } = renderHook(() => useCreatePartner(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            company_name: "New Partner",
            primary_email: "new@partner.com",
            tier: "gold",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.company_name).toBe("New Partner");
        expect(result.current.data?.status).toBe("pending");
      });
    });

    describe("useUpdatePartner", () => {
      it("should update partner successfully", async () => {
        seedPartners([
          {
            id: "partner-update-1",
            company_name: "Old Name",
            status: "pending",
          },
        ]);

        const { result } = renderHook(() => useUpdatePartner(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            partnerId: "partner-update-1",
            data: {
              company_name: "Updated Name",
              status: "active",
            },
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.company_name).toBe("Updated Name");
        expect(result.current.data?.status).toBe("active");
      });
    });

    describe("useDeletePartner", () => {
      it("should delete partner successfully", async () => {
        seedPartners([
          {
            id: "partner-delete-1",
            company_name: "To Delete",
          },
        ]);

        const { result } = renderHook(() => useDeletePartner(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync("partner-delete-1");
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
      });
    });
  });

  describe("Workflow Operations", () => {
    describe("useCheckLicenseQuota", () => {
      it("should check quota successfully", async () => {
        seedPartners([
          {
            id: "partner-123",
            company_name: "Test Partner",
          },
        ]);

        const { result } = renderHook(() => useCheckLicenseQuota(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            partnerId: "partner-123",
            requestedLicenses: 10,
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.available).toBe(true);
        expect(result.current.data?.can_allocate).toBe(true);
      });
    });

    describe("useCreatePartnerCustomer", () => {
      it("should create partner customer successfully", async () => {
        seedPartners([
          {
            id: "partner-123",
            company_name: "Test Partner",
          },
        ]);

        const { result } = renderHook(() => useCreatePartnerCustomer(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            partnerId: "partner-123",
            customerData: {
              first_name: "John",
              last_name: "Doe",
              email: "john@example.com",
              phone: "+1234567890",
              company_name: "John's Company",
            },
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.name).toBe("John Doe");
        expect(result.current.data?.partner_id).toBe("partner-123");
      });
    });

    describe("useAllocateLicenses", () => {
      it("should allocate licenses successfully", async () => {
        seedPartners([
          {
            id: "partner-123",
            company_name: "Test Partner",
          },
        ]);

        const { result } = renderHook(() => useAllocateLicenses(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            partner_id: "partner-123",
            customer_id: "customer-456",
            license_template_id: "template-1",
            license_count: 5,
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.licenses_allocated).toBe(5);
        expect(result.current.data?.partner_id).toBe("partner-123");
      });
    });

    describe("useProvisionPartnerTenant", () => {
      it("should provision tenant without white-label", async () => {
        seedPartners([
          {
            id: "partner-123",
            company_name: "Test Partner",
          },
        ]);

        const { result } = renderHook(() => useProvisionPartnerTenant(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            partner_id: "partner-123",
            customer_id: "customer-456",
            license_key: "key-123",
            deployment_type: "standard",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.partner_id).toBe("partner-123");
        expect(result.current.data?.white_label_applied).toBe(false);
        expect(result.current.data?.tenant_url).toBeDefined();
      });

      it("should provision tenant with white-label config", async () => {
        seedPartners([
          {
            id: "partner-123",
            company_name: "Test Partner",
          },
        ]);

        const { result } = renderHook(() => useProvisionPartnerTenant(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            partner_id: "partner-123",
            customer_id: "customer-456",
            license_key: "key-123",
            deployment_type: "standard",
            white_label_config: {
              company_name: "Custom Brand",
              logo_url: "https://example.com/logo.png",
              primary_color: "#007bff",
            },
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.white_label_applied).toBe(true);
        expect(result.current.data?.white_label_config?.company_name).toBe("Custom Brand");
      });
    });

    describe("useRecordCommission", () => {
      it("should record commission successfully", async () => {
        seedPartners([
          {
            id: "partner-123",
            company_name: "Test Partner",
          },
        ]);

        const { result } = renderHook(() => useRecordCommission(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            partner_id: "partner-123",
            customer_id: "customer-456",
            commission_type: "new_customer",
            amount: 500,
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.commission_type).toBe("new_customer");
        expect(result.current.data?.amount).toBe("500.00");
      });

      it("should record all commission types", async () => {
        seedPartners([
          {
            id: "partner-123",
            company_name: "Test Partner",
          },
        ]);

        const { result } = renderHook(() => useRecordCommission(), {
          wrapper: createQueryWrapper(),
        });

        const types = ["new_customer", "renewal", "upgrade", "usage", "referral"];

        for (const type of types) {
          await act(async () => {
            await result.current.mutateAsync({
              partner_id: "partner-123",
              customer_id: "customer-456",
              commission_type: type,
              amount: 100,
            });
          });

          await waitFor(() => expect(result.current.data?.commission_type).toBe(type));
        }
      });
    });

    describe("useCompletePartnerOnboarding", () => {
      it("should complete onboarding workflow", async () => {
        const { result } = renderHook(() => useCompletePartnerOnboarding(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            partner_data: {
              company_name: "New Partner",
              primary_email: "new@partner.com",
              tier: "gold",
            },
            customer_data: {
              first_name: "First",
              last_name: "Customer",
              email: "customer@example.com",
            },
            license_template_id: "template-1",
            deployment_type: "standard",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.partner).toBeDefined();
        expect(result.current.data?.customer).toBeDefined();
        expect(result.current.data?.licenses).toBeDefined();
        expect(result.current.data?.tenant).toBeDefined();
        expect(result.current.data?.commission).toBeDefined();
        expect(result.current.data?.status).toBe("completed");
      });

      it("should complete onboarding with white-label", async () => {
        const { result } = renderHook(() => useCompletePartnerOnboarding(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            partner_data: {
              company_name: "Premium Partner",
              primary_email: "premium@partner.com",
              tier: "platinum",
            },
            customer_data: {
              first_name: "Enterprise",
              last_name: "Customer",
              email: "enterprise@customer.com",
            },
            license_template_id: "template-1",
            deployment_type: "standard",
            white_label_config: {
              company_name: "Branded Solution",
              logo_url: "https://example.com/logo.png",
              primary_color: "#ff6600",
            },
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.tenant.white_label_applied).toBe(true);
        expect(result.current.data?.tenant.white_label_config?.company_name).toBe("Branded Solution");
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle complete partner lifecycle", async () => {
      // Create partner
      const { result: createResult } = renderHook(() => useCreatePartner(), {
        wrapper: createQueryWrapper(),
      });

      let partnerId: string;

      await act(async () => {
        const partner = await createResult.current.mutateAsync({
          company_name: "Lifecycle Partner",
          primary_email: "lifecycle@partner.com",
          tier: "silver",
        });
        partnerId = partner.id;
      });

      // Update partner
      const { result: updateResult } = renderHook(() => useUpdatePartner(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await updateResult.current.mutateAsync({
          partnerId: partnerId!,
          data: {
            status: "active",
            tier: "gold",
          },
        });
      });

      await waitFor(() => expect(updateResult.current.isSuccess).toBe(true));
      expect(updateResult.current.data?.status).toBe("active");
      expect(updateResult.current.data?.tier).toBe("gold");

      // Delete partner
      const { result: deleteResult } = renderHook(() => useDeletePartner(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await deleteResult.current.mutateAsync(partnerId!);
      });

      await waitFor(() => expect(deleteResult.current.isSuccess).toBe(true));
    });

    it("should handle full onboarding workflow", async () => {
      const { result } = renderHook(() => useCompletePartnerOnboarding(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          partner_data: {
            company_name: "Complete Workflow Partner",
            primary_email: "workflow@partner.com",
            phone: "+1234567890",
            tier: "platinum",
            commission_model: "revenue_share",
            default_commission_rate: 15,
          },
          customer_data: {
            first_name: "Complete",
            last_name: "Customer",
            email: "complete@customer.com",
            phone: "+9876543210",
            company_name: "Customer Corp",
            tier: "premium",
          },
          license_template_id: "template-enterprise",
          deployment_type: "dedicated",
          white_label_config: {
            company_name: "Branded Platform",
            logo_url: "https://example.com/brand-logo.png",
            primary_color: "#0066cc",
            secondary_color: "#ff9900",
            support_email: "support@branded.com",
          },
          environment: "production",
          region: "us-east-1",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const result_data = result.current.data!;

      expect(result_data.partner.company_name).toBe("Complete Workflow Partner");
      expect(result_data.partner.tier).toBe("platinum");
      expect(result_data.customer.name).toBe("Complete Customer");
      expect(result_data.customer.company_name).toBe("Customer Corp");
      expect(result_data.licenses.partner_id).toBe(result_data.partner.id);
      expect(result_data.tenant.white_label_applied).toBe(true);
      expect(result_data.tenant.white_label_config?.company_name).toBe("Branded Platform");
      expect(result_data.commission.commission_type).toBe("new_customer");
      expect(result_data.workflow_id).toBeDefined();
    });

    it("should handle multi-step partner provisioning", async () => {
      seedPartners([
        {
          id: "partner-multi",
          company_name: "Multi-Step Partner",
        },
      ]);

      // Step 1: Create customer
      const { result: customerResult } = renderHook(() => useCreatePartnerCustomer(), {
        wrapper: createQueryWrapper(),
      });

      let customerId: string;

      await act(async () => {
        const customer = await customerResult.current.mutateAsync({
          partnerId: "partner-multi",
          customerData: {
            first_name: "Multi",
            last_name: "Customer",
            email: "multi@customer.com",
          },
          engagementType: "managed",
          customCommissionRate: 12,
        });
        customerId = customer.customer_id;
      });

      // Step 2: Allocate licenses
      const { result: licenseResult } = renderHook(() => useAllocateLicenses(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await licenseResult.current.mutateAsync({
          partner_id: "partner-multi",
          customer_id: customerId!,
          license_template_id: "template-1",
          license_count: 10,
        });
      });

      await waitFor(() => expect(licenseResult.current.isSuccess).toBe(true));
      expect(licenseResult.current.data?.licenses_allocated).toBe(10);

      // Step 3: Provision tenant
      const { result: tenantResult } = renderHook(() => useProvisionPartnerTenant(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await tenantResult.current.mutateAsync({
          partner_id: "partner-multi",
          customer_id: customerId!,
          license_key: licenseResult.current.data!.license_keys[0],
          deployment_type: "cloud",
        });
      });

      await waitFor(() => expect(tenantResult.current.isSuccess).toBe(true));
      expect(tenantResult.current.data?.partner_id).toBe("partner-multi");
      expect(tenantResult.current.data?.status).toBe("active");

      // Step 4: Record commission
      const { result: commissionResult } = renderHook(() => useRecordCommission(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await commissionResult.current.mutateAsync({
          partner_id: "partner-multi",
          customer_id: customerId!,
          commission_type: "new_customer",
          amount: 750,
        });
      });

      await waitFor(() => expect(commissionResult.current.data?.amount).toBe("750.00"));
    });
  });
});
