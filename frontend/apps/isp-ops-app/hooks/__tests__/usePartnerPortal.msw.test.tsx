/**
 * MSW Tests for usePartnerPortal hook
 * Tests partner portal operations with realistic API mocking
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

// Mock AppConfigContext
const buildUrl = (path: string) => `http://localhost:3000/api/v1${path}`;

jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      buildUrl,
    },
    features: {},
    branding: {},
    tenant: {},
  }),
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryWrapper } from "@/__tests__/test-utils";
import {
  usePartnerDashboard,
  usePartnerProfile,
  useUpdatePartnerProfile,
  usePartnerReferrals,
  useSubmitReferral,
  usePartnerCommissions,
  usePartnerCustomers,
  usePartnerStatements,
  usePartnerPayoutHistory,
} from "../usePartnerPortal";
import {
  seedPartnerPortal,
  clearPartnerPortalData,
} from "@/__tests__/msw/handlers/partner-portal";

const waitForLoadingToSettle = async (getLoading: () => boolean) => {
  await waitFor(() => expect(getLoading()).toBe(false), { timeout: 5000 });
};

describe("usePartnerPortal", () => {
  beforeEach(() => {
    clearPartnerPortalData();
  });

  describe("Dashboard Operations", () => {
    describe("usePartnerDashboard", () => {
      it("should fetch dashboard stats successfully", async () => {
        seedPartnerPortal({
          dashboard: {
            total_customers: 50,
            active_customers: 45,
            total_revenue_generated: 100000,
            total_commissions_earned: 10000,
            total_commissions_paid: 8000,
            pending_commissions: 2000,
            total_referrals: 20,
            converted_referrals: 15,
            pending_referrals: 5,
            conversion_rate: 75,
            current_tier: "gold",
            commission_model: "revenue_share",
            default_commission_rate: 15,
          },
        });

        const { result } = renderHook(() => usePartnerDashboard(), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.total_customers).toBe(50);
        expect(result.current.data?.current_tier).toBe("gold");
        expect(result.current.data?.default_commission_rate).toBe(15);
        expect(result.current.data?.conversion_rate).toBe(75);
      });

      it("should return default dashboard when no data seeded", async () => {
        const { result } = renderHook(() => usePartnerDashboard(), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.total_customers).toBe(50);
        expect(result.current.data?.current_tier).toBe("gold");
      });
    });
  });

  describe("Profile Operations", () => {
    describe("usePartnerProfile", () => {
      it("should fetch partner profile successfully", async () => {
        seedPartnerPortal({
          profile: {
            id: "partner-123",
            partner_number: "PTR-000123",
            company_name: "Acme Corporation",
            legal_name: "Acme Corp Ltd",
            website: "https://acme.com",
            status: "active",
            tier: "platinum",
            commission_model: "revenue_share",
            default_commission_rate: 20,
            primary_email: "admin@acme.com",
            billing_email: "billing@acme.com",
            phone: "+1234567890",
          },
        });

        const { result } = renderHook(() => usePartnerProfile(), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.id).toBe("partner-123");
        expect(result.current.data?.company_name).toBe("Acme Corporation");
        expect(result.current.data?.tier).toBe("platinum");
        expect(result.current.data?.default_commission_rate).toBe(20);
      });

      it("should return default profile when no data seeded", async () => {
        const { result } = renderHook(() => usePartnerProfile(), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.company_name).toBe("Portal Partner Company");
        expect(result.current.data?.status).toBe("active");
      });
    });

    describe("useUpdatePartnerProfile", () => {
      it("should update partner profile successfully", async () => {
        seedPartnerPortal({
          profile: {
            id: "partner-123",
            company_name: "Old Company Name",
            status: "active",
            tier: "gold",
          },
        });

        const { result } = renderHook(() => useUpdatePartnerProfile(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            company_name: "New Company Name",
            website: "https://new-company.com",
            phone: "+9876543210",
          });
        });

        await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.company_name).toBe("New Company Name");
        expect(result.current.data?.website).toBe("https://new-company.com");
        expect(result.current.data?.phone).toBe("+9876543210");
      });

      it("should update multiple profile fields", async () => {
        seedPartnerPortal({
          profile: {
            id: "partner-456",
            company_name: "Test Partner",
            tier: "bronze",
          },
        });

        const { result } = renderHook(() => useUpdatePartnerProfile(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            legal_name: "Test Partner Legal Ltd",
            billing_email: "billing@test.com",
            website: "https://test.com",
          });
        });

        await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.legal_name).toBe("Test Partner Legal Ltd");
        expect(result.current.data?.billing_email).toBe("billing@test.com");
      });
    });
  });

  describe("Referral Operations", () => {
    describe("usePartnerReferrals", () => {
      it("should fetch referrals successfully", async () => {
        seedPartnerPortal({
          referrals: [
            {
              id: "ref-1",
              lead_name: "John Doe",
              lead_email: "john@example.com",
              status: "new",
              estimated_value: 50000,
            },
            {
              id: "ref-2",
              lead_name: "Jane Smith",
              lead_email: "jane@example.com",
              status: "contacted",
              estimated_value: 75000,
            },
          ],
        });

        const { result } = renderHook(() => usePartnerReferrals(), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toHaveLength(2);
        expect(result.current.data?.[0].lead_name).toBe("John Doe");
        expect(result.current.data?.[1].status).toBe("contacted");
      });

      it("should support pagination", async () => {
        seedPartnerPortal({
          referrals: Array.from({ length: 25 }, (_, i) => ({
            id: `ref-${i + 1}`,
            lead_name: `Lead ${i + 1}`,
            lead_email: `lead${i + 1}@example.com`,
            status: "new",
          })),
        });

        const { result } = renderHook(() => usePartnerReferrals(10, 5), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.data).toHaveLength(10);
        expect(result.current.data?.[0].id).toBe("ref-6");
      });

      it("should handle empty referrals list", async () => {
        const { result } = renderHook(() => usePartnerReferrals(), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toHaveLength(0);
      });
    });

    describe("useSubmitReferral", () => {
      it("should submit referral successfully", async () => {
        seedPartnerPortal({
          dashboard: {
            total_referrals: 10,
            pending_referrals: 5,
          },
        });

        const { result } = renderHook(() => useSubmitReferral(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            lead_name: "Bob Johnson",
            lead_email: "bob@example.com",
            lead_phone: "+1234567890",
            company_name: "Johnson Enterprises",
            estimated_value: 100000,
            notes: "High-value prospect from industry event",
          });
        });

        await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.lead_name).toBe("Bob Johnson");
        expect(result.current.data?.lead_email).toBe("bob@example.com");
        expect(result.current.data?.status).toBe("new");
        expect(result.current.data?.id).toBeDefined();
      });

      it("should submit minimal referral", async () => {
        const { result } = renderHook(() => useSubmitReferral(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            lead_name: "Simple Lead",
            lead_email: "simple@example.com",
          });
        });

        await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.lead_name).toBe("Simple Lead");
        expect(result.current.data?.status).toBe("new");
      });
    });
  });

  describe("Commission Operations", () => {
    describe("usePartnerCommissions", () => {
      it("should fetch commissions successfully", async () => {
        seedPartnerPortal({
          commissions: [
            {
              id: "comm-1",
              customer_id: "cust-1",
              amount: 10000,
              commission_rate: 15,
              commission_amount: 1500,
              status: "paid",
            },
            {
              id: "comm-2",
              customer_id: "cust-2",
              amount: 5000,
              commission_rate: 15,
              commission_amount: 750,
              status: "pending",
            },
          ],
        });

        const { result } = renderHook(() => usePartnerCommissions(), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toHaveLength(2);
        expect(result.current.data?.[0].commission_amount).toBe(1500);
        expect(result.current.data?.[1].status).toBe("pending");
      });

      it("should support pagination for commissions", async () => {
        seedPartnerPortal({
          commissions: Array.from({ length: 30 }, (_, i) => ({
            id: `comm-${i + 1}`,
            amount: 1000,
            commission_rate: 10,
            commission_amount: 100,
            status: "paid",
          })),
        });

        const { result } = renderHook(() => usePartnerCommissions(10, 10), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.data).toHaveLength(10);
        expect(result.current.data?.[0].id).toBe("comm-11");
      });
    });
  });

  describe("Customer Operations", () => {
    describe("usePartnerCustomers", () => {
      it("should fetch customers successfully", async () => {
        seedPartnerPortal({
          customers: [
            {
              id: "pc-1",
              customer_name: "Customer Alpha",
              engagement_type: "direct",
              total_revenue: 50000,
              total_commissions: 7500,
              is_active: true,
            },
            {
              id: "pc-2",
              customer_name: "Customer Beta",
              engagement_type: "referral",
              total_revenue: 30000,
              total_commissions: 4500,
              is_active: true,
            },
          ],
        });

        const { result } = renderHook(() => usePartnerCustomers(), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toHaveLength(2);
        expect(result.current.data?.[0].customer_name).toBe("Customer Alpha");
        expect(result.current.data?.[1].engagement_type).toBe("referral");
      });

      it("should handle different engagement types", async () => {
        seedPartnerPortal({
          customers: [
            { engagement_type: "direct", customer_name: "Direct Customer" },
            { engagement_type: "referral", customer_name: "Referral Customer" },
            { engagement_type: "reseller", customer_name: "Reseller Customer" },
            { engagement_type: "affiliate", customer_name: "Affiliate Customer" },
          ],
        });

        const { result } = renderHook(() => usePartnerCustomers(), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.data).toHaveLength(4);
        const types = result.current.data?.map((c) => c.engagement_type);
        expect(types).toContain("direct");
        expect(types).toContain("referral");
        expect(types).toContain("reseller");
        expect(types).toContain("affiliate");
      });
    });
  });

  describe("Statement Operations", () => {
    describe("usePartnerStatements", () => {
      it("should fetch statements successfully", async () => {
        seedPartnerPortal({
          statements: [
            {
              id: "stmt-1",
              payout_id: "payout-1",
              revenue_total: 100000,
              commission_total: 15000,
              adjustments_total: -500,
              status: "completed",
            },
            {
              id: "stmt-2",
              revenue_total: 75000,
              commission_total: 11250,
              adjustments_total: 0,
              status: "pending",
            },
          ],
        });

        const { result } = renderHook(() => usePartnerStatements(), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toHaveLength(2);
        expect(result.current.data?.[0].commission_total).toBe(15000);
        expect(result.current.data?.[1].status).toBe("pending");
      });

      it("should handle different statement statuses", async () => {
        seedPartnerPortal({
          statements: [
            { status: "pending" },
            { status: "ready" },
            { status: "processing" },
            { status: "completed" },
          ],
        });

        const { result } = renderHook(() => usePartnerStatements(), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        const statuses = result.current.data?.map((s) => s.status);
        expect(statuses).toContain("pending");
        expect(statuses).toContain("ready");
        expect(statuses).toContain("processing");
        expect(statuses).toContain("completed");
      });
    });
  });

  describe("Payout Operations", () => {
    describe("usePartnerPayoutHistory", () => {
      it("should fetch payout history successfully", async () => {
        seedPartnerPortal({
          payouts: [
            {
              id: "payout-1",
              total_amount: 15000,
              currency: "USD",
              commission_count: 20,
              payment_method: "bank_transfer",
              status: "completed",
              payment_reference: "PAY-2024-001",
            },
            {
              id: "payout-2",
              total_amount: 8500,
              currency: "USD",
              commission_count: 12,
              payment_method: "bank_transfer",
              status: "processing",
            },
          ],
        });

        const { result } = renderHook(() => usePartnerPayoutHistory(), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toHaveLength(2);
        expect(result.current.data?.[0].total_amount).toBe(15000);
        expect(result.current.data?.[0].status).toBe("completed");
        expect(result.current.data?.[1].commission_count).toBe(12);
      });

      it("should handle different payout statuses", async () => {
        seedPartnerPortal({
          payouts: [
            { status: "pending", total_amount: 1000 },
            { status: "processing", total_amount: 2000 },
            { status: "completed", total_amount: 3000 },
            { status: "failed", total_amount: 4000, failure_reason: "Insufficient funds" },
          ],
        });

        const { result } = renderHook(() => usePartnerPayoutHistory(), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.data).toHaveLength(4);
        const failedPayout = result.current.data?.find((p) => p.status === "failed");
        expect(failedPayout?.failure_reason).toBe("Insufficient funds");
      });

      it("should support pagination for payouts", async () => {
        seedPartnerPortal({
          payouts: Array.from({ length: 20 }, (_, i) => ({
            id: `payout-${i + 1}`,
            total_amount: (i + 1) * 1000,
            status: "completed",
          })),
        });

        const { result } = renderHook(() => usePartnerPayoutHistory(5, 5), {
          wrapper: createQueryWrapper(),
        });

        await waitForLoadingToSettle(() => result.current.isLoading);

        expect(result.current.data).toHaveLength(5);
        expect(result.current.data?.[0].id).toBe("payout-6");
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle complete partner portal workflow", async () => {
      // Setup initial data
      seedPartnerPortal({
        profile: {
          id: "partner-workflow",
          company_name: "Workflow Partner",
          tier: "gold",
        },
        dashboard: {
          total_customers: 25,
          total_referrals: 10,
          pending_referrals: 5,
        },
      });

      // Fetch profile
      const { result: profileResult } = renderHook(() => usePartnerProfile(), {
        wrapper: createQueryWrapper(),
      });

      await waitForLoadingToSettle(() => profileResult.current.isLoading);
      expect(profileResult.current.data?.company_name).toBe("Workflow Partner");

      // Update profile
      const { result: updateResult } = renderHook(() => useUpdatePartnerProfile(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await updateResult.current.mutateAsync({
          website: "https://workflow-partner.com",
        });
      });

      await waitFor(() => expect(updateResult.current.isSuccess || updateResult.current.isError).toBe(true));
      expect(updateResult.current.data?.website).toBe("https://workflow-partner.com");

      // Submit referral
      const { result: referralResult } = renderHook(() => useSubmitReferral(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await referralResult.current.mutateAsync({
          lead_name: "New Lead",
          lead_email: "newlead@example.com",
        });
      });

      await waitFor(() => expect(referralResult.current.isSuccess || referralResult.current.isError).toBe(true));
      expect(referralResult.current.data?.lead_name).toBe("New Lead");
    });

    it("should handle partner with multiple data types", async () => {
      seedPartnerPortal({
        profile: {
          company_name: "Multi-Data Partner",
          tier: "platinum",
        },
        referrals: [
          { lead_name: "Lead 1", status: "new" },
          { lead_name: "Lead 2", status: "converted" },
        ],
        commissions: [
          { amount: 5000, commission_amount: 750, status: "paid" },
          { amount: 3000, commission_amount: 450, status: "pending" },
        ],
        customers: [
          { customer_name: "Customer 1", is_active: true },
          { customer_name: "Customer 2", is_active: true },
        ],
        statements: [
          { revenue_total: 50000, commission_total: 7500, status: "completed" },
        ],
        payouts: [
          { total_amount: 7500, status: "completed" },
        ],
      });

      // Verify all data types are accessible
      const { result: profileResult } = renderHook(() => usePartnerProfile(), {
        wrapper: createQueryWrapper(),
      });
      const { result: referralsResult } = renderHook(() => usePartnerReferrals(), {
        wrapper: createQueryWrapper(),
      });
      const { result: commissionsResult } = renderHook(() => usePartnerCommissions(), {
        wrapper: createQueryWrapper(),
      });
      const { result: customersResult } = renderHook(() => usePartnerCustomers(), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => {
        expect(profileResult.current.isLoading).toBe(false);
        expect(referralsResult.current.isLoading).toBe(false);
        expect(commissionsResult.current.isLoading).toBe(false);
        expect(customersResult.current.isLoading).toBe(false);
      });

      expect(profileResult.current.data?.tier).toBe("platinum");
      expect(referralsResult.current.data).toHaveLength(2);
      expect(commissionsResult.current.data).toHaveLength(2);
      expect(customersResult.current.data).toHaveLength(2);
    });
  });
});
