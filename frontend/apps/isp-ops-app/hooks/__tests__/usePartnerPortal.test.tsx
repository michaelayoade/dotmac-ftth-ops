/**
 * Jest Mock Tests for usePartnerPortal hook
 * Tests partner portal operations with fetch mocking
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

// Import MSW server to disable it
const { server } = require("@/__tests__/msw/server");

// Mock useAppConfig
jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
    },
  }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Create a wrapper component with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Disable MSW server to allow mock fetch to work
beforeAll(() => {
  server.close();
});

afterAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("usePartnerPortal", () => {
  describe("Dashboard Operations", () => {
    describe("usePartnerDashboard", () => {
      it("should fetch dashboard stats successfully", async () => {
        const mockDashboard = {
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
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockDashboard,
        });

        const { result } = renderHook(() => usePartnerDashboard(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/isp/v1/partners/portal/dashboard",
          expect.objectContaining({
            credentials: "include",
          }),
        );
        expect(result.current.data?.total_customers).toBe(50);
        expect(result.current.data?.current_tier).toBe("gold");
        expect(result.current.data?.default_commission_rate).toBe(15);
        expect(result.current.data?.conversion_rate).toBe(75);
      });
    });
  });

  describe("Profile Operations", () => {
    describe("usePartnerProfile", () => {
      it("should fetch partner profile successfully", async () => {
        const mockProfile = {
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
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockProfile,
        });

        const { result } = renderHook(() => usePartnerProfile(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/isp/v1/partners/portal/profile",
          expect.objectContaining({
            credentials: "include",
          }),
        );
        expect(result.current.data?.id).toBe("partner-123");
        expect(result.current.data?.company_name).toBe("Acme Corporation");
        expect(result.current.data?.tier).toBe("platinum");
        expect(result.current.data?.default_commission_rate).toBe(20);
      });
    });

    describe("useUpdatePartnerProfile", () => {
      it("should update partner profile successfully", async () => {
        const mockProfile = {
          id: "partner-123",
          partner_number: "PTR-000123",
          company_name: "New Company Name",
          website: "https://new-company.com",
          phone: "+9876543210",
          status: "active",
          tier: "gold",
          commission_model: "revenue_share",
          primary_email: "admin@acme.com",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockProfile,
        });

        const { result } = renderHook(() => useUpdatePartnerProfile(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            company_name: "New Company Name",
            website: "https://new-company.com",
            phone: "+9876543210",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/isp/v1/partners/portal/profile",
          expect.objectContaining({
            method: "PATCH",
            credentials: "include",
            body: JSON.stringify({
              company_name: "New Company Name",
              website: "https://new-company.com",
              phone: "+9876543210",
            }),
          }),
        );
        expect(result.current.data?.company_name).toBe("New Company Name");
        expect(result.current.data?.website).toBe("https://new-company.com");
        expect(result.current.data?.phone).toBe("+9876543210");
      });
    });
  });

  describe("Referral Operations", () => {
    describe("usePartnerReferrals", () => {
      it("should fetch referrals successfully", async () => {
        const mockReferrals = [
          {
            id: "ref-1",
            partner_id: "partner-123",
            lead_name: "John Doe",
            lead_email: "john@example.com",
            status: "new",
            estimated_value: 50000,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
          {
            id: "ref-2",
            partner_id: "partner-123",
            lead_name: "Jane Smith",
            lead_email: "jane@example.com",
            status: "contacted",
            estimated_value: 75000,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockReferrals,
        });

        const { result } = renderHook(() => usePartnerReferrals(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/isp/v1/partners/portal/referrals",
          expect.objectContaining({
            credentials: "include",
          }),
        );
        if (result.current.data) {
          expect(result.current.data).toHaveLength(2);
          expect(result.current.data[0].lead_name).toBe("John Doe");
          expect(result.current.data[1].status).toBe("contacted");
        }
      });

      it("should support pagination", async () => {
        const mockReferrals = Array.from({ length: 10 }, (_, i) => ({
          id: `ref-${i + 6}`,
          partner_id: "partner-123",
          lead_name: `Lead ${i + 6}`,
          lead_email: `lead${i + 6}@example.com`,
          status: "new" as const,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        }));

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockReferrals,
        });

        const { result } = renderHook(() => usePartnerReferrals(10, 5), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("limit=10"),
          expect.any(Object),
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("offset=5"),
          expect.any(Object),
        );
        expect(result.current.data).toHaveLength(10);
      });
    });

    describe("useSubmitReferral", () => {
      it("should submit referral successfully", async () => {
        const mockReferral = {
          id: "ref-new",
          partner_id: "partner-123",
          lead_name: "Bob Johnson",
          lead_email: "bob@example.com",
          lead_phone: "+1234567890",
          company_name: "Johnson Enterprises",
          estimated_value: 100000,
          notes: "High-value prospect from industry event",
          status: "new" as const,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockReferral,
        });

        const { result } = renderHook(() => useSubmitReferral(), {
          wrapper: createWrapper(),
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

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.lead_name).toBe("Bob Johnson");
        expect(result.current.data?.lead_email).toBe("bob@example.com");
        expect(result.current.data?.status).toBe("new");
      });
    });
  });

  describe("Commission Operations", () => {
    describe("usePartnerCommissions", () => {
      it("should fetch commissions successfully", async () => {
        const mockCommissions = [
          {
            id: "comm-1",
            partner_id: "partner-123",
            customer_id: "cust-1",
            amount: 10000,
            commission_rate: 15,
            commission_amount: 1500,
            status: "paid" as const,
            event_date: "2025-01-01T00:00:00Z",
            created_at: "2025-01-01T00:00:00Z",
          },
          {
            id: "comm-2",
            partner_id: "partner-123",
            customer_id: "cust-2",
            amount: 5000,
            commission_rate: 15,
            commission_amount: 750,
            status: "pending" as const,
            event_date: "2025-01-01T00:00:00Z",
            created_at: "2025-01-01T00:00:00Z",
          },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCommissions,
        });

        const { result } = renderHook(() => usePartnerCommissions(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/isp/v1/partners/portal/commissions",
          expect.objectContaining({
            credentials: "include",
          }),
        );
        if (result.current.data) {
          expect(result.current.data).toHaveLength(2);
          expect(result.current.data[0].commission_amount).toBe(1500);
          expect(result.current.data[1].status).toBe("pending");
        }
      });
    });
  });

  describe("Customer Operations", () => {
    describe("usePartnerCustomers", () => {
      it("should fetch customers successfully", async () => {
        const mockCustomers = [
          {
            id: "pc-1",
            customer_id: "cust-1",
            customer_name: "Customer Alpha",
            engagement_type: "direct" as const,
            total_revenue: 50000,
            total_commissions: 7500,
            is_active: true,
            start_date: "2025-01-01T00:00:00Z",
          },
          {
            id: "pc-2",
            customer_id: "cust-2",
            customer_name: "Customer Beta",
            engagement_type: "referral" as const,
            total_revenue: 30000,
            total_commissions: 4500,
            is_active: true,
            start_date: "2025-01-01T00:00:00Z",
          },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomers,
        });

        const { result } = renderHook(() => usePartnerCustomers(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/isp/v1/partners/portal/customers",
          expect.objectContaining({
            credentials: "include",
          }),
        );
        if (result.current.data) {
          expect(result.current.data).toHaveLength(2);
          expect(result.current.data[0].customer_name).toBe("Customer Alpha");
          expect(result.current.data[1].engagement_type).toBe("referral");
        }
      });
    });
  });

  describe("Statement Operations", () => {
    describe("usePartnerStatements", () => {
      it("should fetch statements successfully", async () => {
        const mockStatements = [
          {
            id: "stmt-1",
            payout_id: "payout-1",
            period_start: "2025-01-01T00:00:00Z",
            period_end: "2025-01-31T23:59:59Z",
            issued_at: "2025-02-01T00:00:00Z",
            revenue_total: 100000,
            commission_total: 15000,
            adjustments_total: -500,
            status: "completed" as const,
          },
          {
            id: "stmt-2",
            payout_id: null,
            period_start: "2025-02-01T00:00:00Z",
            period_end: "2025-02-28T23:59:59Z",
            issued_at: "2025-03-01T00:00:00Z",
            revenue_total: 75000,
            commission_total: 11250,
            adjustments_total: 0,
            status: "pending" as const,
          },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatements,
        });

        const { result } = renderHook(() => usePartnerStatements(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/isp/v1/partners/portal/statements",
          expect.objectContaining({
            credentials: "include",
          }),
        );
        if (result.current.data) {
          expect(result.current.data).toHaveLength(2);
          expect(result.current.data[0].commission_total).toBe(15000);
          expect(result.current.data[1].status).toBe("pending");
        }
      });
    });
  });

  describe("Payout Operations", () => {
    describe("usePartnerPayoutHistory", () => {
      it("should fetch payout history successfully", async () => {
        const mockPayouts = [
          {
            id: "payout-1",
            partner_id: "partner-123",
            total_amount: 15000,
            currency: "USD",
            commission_count: 20,
            payment_method: "bank_transfer",
            status: "completed" as const,
            payment_reference: "PAY-2024-001",
            payout_date: "2025-01-01T00:00:00Z",
            period_start: "2024-12-01T00:00:00Z",
            period_end: "2024-12-31T23:59:59Z",
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
          {
            id: "payout-2",
            partner_id: "partner-123",
            total_amount: 8500,
            currency: "USD",
            commission_count: 12,
            payment_method: "bank_transfer",
            status: "processing" as const,
            payout_date: "2025-02-01T00:00:00Z",
            period_start: "2025-01-01T00:00:00Z",
            period_end: "2025-01-31T23:59:59Z",
            created_at: "2025-02-01T00:00:00Z",
            updated_at: "2025-02-01T00:00:00Z",
          },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockPayouts,
        });

        const { result } = renderHook(() => usePartnerPayoutHistory(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/isp/v1/partners/portal/payouts",
          expect.objectContaining({
            credentials: "include",
          }),
        );
        if (result.current.data) {
          expect(result.current.data).toHaveLength(2);
          expect(result.current.data[0].total_amount).toBe(15000);
          expect(result.current.data[0].status).toBe("completed");
          expect(result.current.data[1].commission_count).toBe(12);
        }
      });
    });
  });
});
