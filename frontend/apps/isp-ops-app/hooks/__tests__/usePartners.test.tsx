/**
 * Tests for usePartners hooks
 * Tests partner management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
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
  Partner,
  PartnerListResponse,
  CreatePartnerInput,
  UpdatePartnerInput,
  QuotaCheckResult,
  PartnerCustomerInput,
  PartnerCustomerResult,
  LicenseAllocationInput,
  LicenseAllocationResult,
  TenantProvisioningInput,
  TenantProvisioningResult,
  CommissionRecordInput,
  CommissionRecordResult,
  PartnerOnboardingInput,
  PartnerOnboardingResult,
} from "../usePartners";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock fetch globally
global.fetch = jest.fn();

describe("usePartners", () => {
  function createWrapper() {
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
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("usePartners - list partners", () => {
    it("should fetch partners successfully", async () => {
      const mockPartners: Partner[] = [
        {
          id: "partner-1",
          partner_number: "PTR-001",
          company_name: "Partner Company",
          legal_name: "Partner Company LLC",
          website: "https://partner.com",
          status: "active",
          tier: "gold",
          commission_model: "revenue_share",
          default_commission_rate: 15.0,
          primary_email: "contact@partner.com",
          billing_email: "billing@partner.com",
          phone: "+1234567890",
          total_customers: 50,
          total_revenue_generated: 100000,
          total_commissions_earned: 15000,
          total_commissions_paid: 10000,
          total_referrals: 75,
          converted_referrals: 50,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-15T00:00:00Z",
        },
      ];

      const mockResponse: PartnerListResponse = {
        partners: mockPartners,
        total: 1,
        page: 1,
        page_size: 50,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => usePartners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.partners).toHaveLength(1);
      expect(result.current.data?.partners[0].company_name).toBe("Partner Company");
      expect(result.current.data?.total).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/partners?page=1&page_size=50"),
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("should fetch partners with status filter", async () => {
      const mockResponse: PartnerListResponse = {
        partners: [],
        total: 0,
        page: 1,
        page_size: 50,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      renderHook(() => usePartners("active", 1, 50), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("status=active"),
          expect.anything()
        );
      });
    });

    it("should fetch partners with custom pagination", async () => {
      const mockResponse: PartnerListResponse = {
        partners: [],
        total: 0,
        page: 2,
        page_size: 25,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      renderHook(() => usePartners(undefined, 2, 25), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("page=2&page_size=25"),
          expect.anything()
        );
      });
    });

    it("should handle empty partners array", async () => {
      const mockResponse: PartnerListResponse = {
        partners: [],
        total: 0,
        page: 1,
        page_size: 50,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => usePartners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.partners).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle fetch error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => usePartners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle all partner statuses", async () => {
      const statuses: Partner["status"][] = [
        "pending",
        "active",
        "suspended",
        "terminated",
        "archived",
      ];

      for (const status of statuses) {
        const mockResponse: PartnerListResponse = {
          partners: [
            {
              id: `partner-${status}`,
              partner_number: "PTR-001",
              company_name: `${status} Partner`,
              status,
              tier: "bronze",
              commission_model: "flat_fee",
              primary_email: `${status}@partner.com`,
              total_customers: 0,
              total_revenue_generated: 0,
              total_commissions_earned: 0,
              total_commissions_paid: 0,
              total_referrals: 0,
              converted_referrals: 0,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          total: 1,
          page: 1,
          page_size: 50,
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        });

        const { result } = renderHook(() => usePartners(status), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.partners[0].status).toBe(status);

        jest.clearAllMocks();
      }
    });

    it("should handle all partner tiers", async () => {
      const tiers: Partner["tier"][] = ["bronze", "silver", "gold", "platinum", "direct"];

      for (const tier of tiers) {
        const mockResponse: PartnerListResponse = {
          partners: [
            {
              id: `partner-${tier}`,
              partner_number: "PTR-001",
              company_name: `${tier} Partner`,
              status: "active",
              tier,
              commission_model: "revenue_share",
              primary_email: `${tier}@partner.com`,
              total_customers: 0,
              total_revenue_generated: 0,
              total_commissions_earned: 0,
              total_commissions_paid: 0,
              total_referrals: 0,
              converted_referrals: 0,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          total: 1,
          page: 1,
          page_size: 50,
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        });

        const { result } = renderHook(() => usePartners(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.partners[0].tier).toBe(tier);

        jest.clearAllMocks();
      }
    });

    it("should set loading state correctly", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    partners: [],
                    total: 0,
                    page: 1,
                    page_size: 50,
                  }),
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => usePartners(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });
  });

  describe("usePartner - single partner", () => {
    it("should fetch single partner successfully", async () => {
      const mockPartner: Partner = {
        id: "partner-1",
        partner_number: "PTR-001",
        company_name: "Partner Company",
        status: "active",
        tier: "gold",
        commission_model: "revenue_share",
        default_commission_rate: 15.0,
        primary_email: "contact@partner.com",
        total_customers: 50,
        total_revenue_generated: 100000,
        total_commissions_earned: 15000,
        total_commissions_paid: 10000,
        total_referrals: 75,
        converted_referrals: 50,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockPartner,
      });

      const { result } = renderHook(() => usePartner("partner-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockPartner);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/partners/partner-1"),
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("should not fetch when partnerId is undefined", async () => {
      const { result } = renderHook(() => usePartner(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() => usePartner("partner-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useCreatePartner - create partner", () => {
    it("should create partner successfully", async () => {
      const mockCreatedPartner: Partner = {
        id: "partner-new",
        partner_number: "PTR-002",
        company_name: "New Partner",
        status: "pending",
        tier: "bronze",
        commission_model: "flat_fee",
        primary_email: "new@partner.com",
        total_customers: 0,
        total_revenue_generated: 0,
        total_commissions_earned: 0,
        total_commissions_paid: 0,
        total_referrals: 0,
        converted_referrals: 0,
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockCreatedPartner,
      });

      const { result } = renderHook(() => useCreatePartner(), {
        wrapper: createWrapper(),
      });

      const createData: CreatePartnerInput = {
        company_name: "New Partner",
        primary_email: "new@partner.com",
        tier: "bronze",
        commission_model: "flat_fee",
      };

      let createdPartner: Partner | undefined;
      await act(async () => {
        createdPartner = await result.current.mutateAsync(createData);
      });

      expect(createdPartner).toEqual(mockCreatedPartner);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/partners"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(createData),
        })
      );
    });

    it("should invalidate queries after successful creation", async () => {
      const mockCreatedPartner: Partner = {
        id: "partner-new",
        partner_number: "PTR-002",
        company_name: "New Partner",
        status: "pending",
        tier: "bronze",
        commission_model: "flat_fee",
        primary_email: "new@partner.com",
        total_customers: 0,
        total_revenue_generated: 0,
        total_commissions_earned: 0,
        total_commissions_paid: 0,
        total_referrals: 0,
        converted_referrals: 0,
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Mock initial partners fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          partners: [],
          total: 0,
          page: 1,
          page_size: 50,
        }),
      });

      const { result: partnersResult } = renderHook(() => usePartners(), { wrapper });
      await waitFor(() => expect(partnersResult.current.isLoading).toBe(false));

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Mock create partner
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedPartner,
      });

      // Mock refetch after invalidation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          partners: [mockCreatedPartner],
          total: 1,
          page: 1,
          page_size: 50,
        }),
      });

      const { result: createResult } = renderHook(() => useCreatePartner(), { wrapper });

      await act(async () => {
        await createResult.current.mutateAsync({
          company_name: "New Partner",
          primary_email: "new@partner.com",
        });
      });

      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle create error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: "Invalid data" }),
      });

      const { result } = renderHook(() => useCreatePartner(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            company_name: "New Partner",
            primary_email: "new@partner.com",
          });
        })
      ).rejects.toThrow();
    });

    it("should set isPending state correctly during mutation", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({}),
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useCreatePartner(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate({
          company_name: "New Partner",
          primary_email: "new@partner.com",
        });
      });

      await waitFor(() => expect(result.current.isPending).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 200 });
    });
  });

  describe("useUpdatePartner - update partner", () => {
    it("should update partner successfully", async () => {
      const mockUpdatedPartner: Partner = {
        id: "partner-1",
        partner_number: "PTR-001",
        company_name: "Updated Partner",
        status: "active",
        tier: "platinum",
        commission_model: "revenue_share",
        default_commission_rate: 20.0,
        primary_email: "updated@partner.com",
        total_customers: 50,
        total_revenue_generated: 100000,
        total_commissions_earned: 15000,
        total_commissions_paid: 10000,
        total_referrals: 75,
        converted_referrals: 50,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockUpdatedPartner,
      });

      const { result } = renderHook(() => useUpdatePartner(), {
        wrapper: createWrapper(),
      });

      const updateData: UpdatePartnerInput = {
        company_name: "Updated Partner",
        tier: "platinum",
        default_commission_rate: 20.0,
      };

      let updatedPartner: Partner | undefined;
      await act(async () => {
        updatedPartner = await result.current.mutateAsync({
          partnerId: "partner-1",
          data: updateData,
        });
      });

      expect(updatedPartner).toEqual(mockUpdatedPartner);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/partners/partner-1"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(updateData),
        })
      );
    });

    it("should invalidate queries after successful update", async () => {
      const mockUpdatedPartner: Partner = {
        id: "partner-1",
        partner_number: "PTR-001",
        company_name: "Updated Partner",
        status: "active",
        tier: "gold",
        commission_model: "revenue_share",
        primary_email: "updated@partner.com",
        total_customers: 50,
        total_revenue_generated: 100000,
        total_commissions_earned: 15000,
        total_commissions_paid: 10000,
        total_referrals: 75,
        converted_referrals: 50,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Mock initial fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          partners: [],
          total: 0,
          page: 1,
          page_size: 50,
        }),
      });

      const { result: partnersResult } = renderHook(() => usePartners(), { wrapper });
      await waitFor(() => expect(partnersResult.current.isLoading).toBe(false));

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Mock update
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdatedPartner,
      });

      // Mock refetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          partners: [mockUpdatedPartner],
          total: 1,
          page: 1,
          page_size: 50,
        }),
      });

      const { result: updateResult } = renderHook(() => useUpdatePartner(), { wrapper });

      await act(async () => {
        await updateResult.current.mutateAsync({
          partnerId: "partner-1",
          data: { company_name: "Updated Partner" },
        });
      });

      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle update error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: "Invalid update data" }),
      });

      const { result } = renderHook(() => useUpdatePartner(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            partnerId: "partner-1",
            data: { company_name: "Updated Partner" },
          });
        })
      ).rejects.toThrow();
    });
  });

  describe("useDeletePartner - delete partner", () => {
    it("should delete partner successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      const { result } = renderHook(() => useDeletePartner(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("partner-1");
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/partners/partner-1"),
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("should invalidate queries after successful deletion", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Mock initial fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          partners: [],
          total: 0,
          page: 1,
          page_size: 50,
        }),
      });

      const { result: partnersResult } = renderHook(() => usePartners(), { wrapper });
      await waitFor(() => expect(partnersResult.current.isLoading).toBe(false));

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Mock delete
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      // Mock refetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          partners: [],
          total: 0,
          page: 1,
          page_size: 50,
        }),
      });

      const { result: deleteResult } = renderHook(() => useDeletePartner(), { wrapper });

      await act(async () => {
        await deleteResult.current.mutateAsync("partner-1");
      });

      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle delete error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() => useDeletePartner(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("partner-1");
        })
      ).rejects.toThrow();
    });
  });

  describe("useCheckLicenseQuota - check license quota", () => {
    it("should check license quota successfully", async () => {
      const mockQuotaResult: QuotaCheckResult = {
        available: true,
        quota_remaining: 50,
        quota_allocated: 100,
        quota_used: 50,
        requested_licenses: 10,
        partner_id: "partner-1",
        partner_number: "PTR-001",
        partner_name: "Partner Company",
        partner_status: "active",
        partner_tier: "gold",
        can_allocate: true,
        is_unlimited: false,
        checked_at: "2024-01-20T00:00:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockQuotaResult,
      });

      const { result } = renderHook(() => useCheckLicenseQuota(), {
        wrapper: createWrapper(),
      });

      let quotaResult: QuotaCheckResult | undefined;
      await act(async () => {
        quotaResult = await result.current.mutateAsync({
          partnerId: "partner-1",
          requestedLicenses: 10,
        });
      });

      expect(quotaResult).toEqual(mockQuotaResult);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/partners/partner-1/quota/check"),
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("should check license quota with tenant ID", async () => {
      const mockQuotaResult: QuotaCheckResult = {
        available: true,
        quota_remaining: 50,
        quota_allocated: 100,
        quota_used: 50,
        requested_licenses: 5,
        partner_id: "partner-1",
        partner_number: "PTR-001",
        partner_name: "Partner Company",
        partner_status: "active",
        partner_tier: "gold",
        can_allocate: true,
        is_unlimited: false,
        checked_at: "2024-01-20T00:00:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockQuotaResult,
      });

      const { result } = renderHook(() => useCheckLicenseQuota(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          partnerId: "partner-1",
          requestedLicenses: 5,
          tenantId: "tenant-1",
        });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("tenant_id=tenant-1"),
        expect.anything()
      );
    });

    it("should handle quota check error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: "Insufficient quota" }),
      });

      const { result } = renderHook(() => useCheckLicenseQuota(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            partnerId: "partner-1",
            requestedLicenses: 1000,
          });
        })
      ).rejects.toThrow();
    });
  });

  describe("useCreatePartnerCustomer - create partner customer", () => {
    it("should create partner customer successfully", async () => {
      const mockCustomerResult: PartnerCustomerResult = {
        customer_id: "cust-1",
        customer_number: "CUST-001",
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        tier: "premium",
        partner_id: "partner-1",
        partner_number: "PTR-001",
        partner_name: "Partner Company",
        partner_account_id: "acc-1",
        engagement_type: "managed",
        commission_rate: "15.0",
        quota_remaining: 49,
        created_at: "2024-01-20T00:00:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockCustomerResult,
      });

      const { result } = renderHook(() => useCreatePartnerCustomer(), {
        wrapper: createWrapper(),
      });

      const customerData: PartnerCustomerInput = {
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
      };

      let customerResult: PartnerCustomerResult | undefined;
      await act(async () => {
        customerResult = await result.current.mutateAsync({
          partnerId: "partner-1",
          customerData,
        });
      });

      expect(customerResult).toEqual(mockCustomerResult);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/partners/partner-1/customers"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should invalidate queries after creating customer", async () => {
      const mockCustomerResult: PartnerCustomerResult = {
        customer_id: "cust-1",
        customer_number: "CUST-001",
        name: "John Doe",
        email: "john@example.com",
        tier: "premium",
        partner_id: "partner-1",
        partner_number: "PTR-001",
        partner_name: "Partner Company",
        partner_account_id: "acc-1",
        engagement_type: "managed",
        commission_rate: "15.0",
        quota_remaining: 49,
        created_at: "2024-01-20T00:00:00Z",
      };

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Mock initial fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          partners: [],
          total: 0,
          page: 1,
          page_size: 50,
        }),
      });

      const { result: partnersResult } = renderHook(() => usePartners(), { wrapper });
      await waitFor(() => expect(partnersResult.current.isLoading).toBe(false));

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Mock create customer
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomerResult,
      });

      // Mock refetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          partners: [],
          total: 0,
          page: 1,
          page_size: 50,
        }),
      });

      const { result: createResult } = renderHook(() => useCreatePartnerCustomer(), { wrapper });

      await act(async () => {
        await createResult.current.mutateAsync({
          partnerId: "partner-1",
          customerData: {
            first_name: "John",
            last_name: "Doe",
            email: "john@example.com",
          },
        });
      });

      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe("useAllocateLicenses - allocate licenses", () => {
    it("should allocate licenses successfully", async () => {
      const mockAllocationResult: LicenseAllocationResult = {
        partner_id: "partner-1",
        partner_name: "Partner Company",
        customer_id: "cust-1",
        licenses_allocated: 5,
        license_keys: ["KEY-1", "KEY-2", "KEY-3", "KEY-4", "KEY-5"],
        license_ids: ["lic-1", "lic-2", "lic-3", "lic-4", "lic-5"],
        template_id: "tmpl-1",
        template_name: "Enterprise License",
        product_id: "prod-1",
        quota_before: 50,
        quota_after: 45,
        quota_remaining: 45,
        allocated_at: "2024-01-20T00:00:00Z",
        status: "active",
        engagement_type: "managed",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockAllocationResult,
      });

      const { result } = renderHook(() => useAllocateLicenses(), {
        wrapper: createWrapper(),
      });

      const allocationData: LicenseAllocationInput = {
        partner_id: "partner-1",
        customer_id: "cust-1",
        license_template_id: "tmpl-1",
        license_count: 5,
      };

      let allocationResult: LicenseAllocationResult | undefined;
      await act(async () => {
        allocationResult = await result.current.mutateAsync(allocationData);
      });

      expect(allocationResult).toEqual(mockAllocationResult);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/partners/partner-1/licenses/allocate"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should invalidate queries after allocating licenses", async () => {
      const mockAllocationResult: LicenseAllocationResult = {
        partner_id: "partner-1",
        partner_name: "Partner Company",
        customer_id: "cust-1",
        licenses_allocated: 5,
        license_keys: ["KEY-1"],
        license_ids: ["lic-1"],
        template_id: "tmpl-1",
        template_name: "Enterprise License",
        product_id: "prod-1",
        quota_before: 50,
        quota_after: 45,
        quota_remaining: 45,
        allocated_at: "2024-01-20T00:00:00Z",
        status: "active",
        engagement_type: "managed",
      };

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Mock initial fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          partners: [],
          total: 0,
          page: 1,
          page_size: 50,
        }),
      });

      const { result: partnersResult } = renderHook(() => usePartners(), { wrapper });
      await waitFor(() => expect(partnersResult.current.isLoading).toBe(false));

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Mock allocate licenses
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAllocationResult,
      });

      // Mock refetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          partners: [],
          total: 0,
          page: 1,
          page_size: 50,
        }),
      });

      const { result: allocateResult } = renderHook(() => useAllocateLicenses(), { wrapper });

      await act(async () => {
        await allocateResult.current.mutateAsync({
          partner_id: "partner-1",
          customer_id: "cust-1",
          license_template_id: "tmpl-1",
        });
      });

      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe("useProvisionPartnerTenant - provision tenant", () => {
    it("should provision partner tenant successfully", async () => {
      const mockTenantResult: TenantProvisioningResult = {
        tenant_url: "https://tenant1.example.com",
        tenant_id: 1,
        instance_id: "inst-1",
        deployment_type: "dedicated",
        partner_id: "partner-1",
        partner_number: "PTR-001",
        partner_name: "Partner Company",
        white_label_applied: true,
        engagement_type: "managed",
        status: "active",
        allocated_resources: {
          cpu: 4,
          memory_gb: 16,
          storage_gb: 500,
        },
        endpoints: {
          api: "https://api.tenant1.example.com",
          web: "https://tenant1.example.com",
        },
        provisioned_at: "2024-01-20T00:00:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTenantResult,
      });

      const { result } = renderHook(() => useProvisionPartnerTenant(), {
        wrapper: createWrapper(),
      });

      const provisionData: TenantProvisioningInput = {
        customer_id: "cust-1",
        partner_id: "partner-1",
        license_key: "KEY-1",
        deployment_type: "dedicated",
      };

      let tenantResult: TenantProvisioningResult | undefined;
      await act(async () => {
        tenantResult = await result.current.mutateAsync(provisionData);
      });

      expect(tenantResult).toEqual(mockTenantResult);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/partners/partner-1/tenants/provision"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should provision tenant with white label config", async () => {
      const mockTenantResult: TenantProvisioningResult = {
        tenant_url: "https://custom.tenant.com",
        tenant_id: 1,
        instance_id: "inst-1",
        deployment_type: "dedicated",
        partner_id: "partner-1",
        partner_number: "PTR-001",
        partner_name: "Partner Company",
        white_label_applied: true,
        white_label_config: {
          company_name: "Custom Company",
          logo_url: "https://logo.example.com",
          primary_color: "#0000FF",
        },
        custom_domain: "custom.tenant.com",
        engagement_type: "managed",
        status: "active",
        allocated_resources: {
          cpu: 4,
          memory_gb: 16,
          storage_gb: 500,
        },
        endpoints: {
          api: "https://api.custom.tenant.com",
          web: "https://custom.tenant.com",
        },
        provisioned_at: "2024-01-20T00:00:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTenantResult,
      });

      const { result } = renderHook(() => useProvisionPartnerTenant(), {
        wrapper: createWrapper(),
      });

      const provisionData: TenantProvisioningInput = {
        customer_id: "cust-1",
        partner_id: "partner-1",
        license_key: "KEY-1",
        deployment_type: "dedicated",
        white_label_config: {
          company_name: "Custom Company",
          logo_url: "https://logo.example.com",
          primary_color: "#0000FF",
        },
      };

      await act(async () => {
        await result.current.mutateAsync(provisionData);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: expect.stringContaining("Custom Company"),
        })
      );
    });
  });

  describe("useRecordCommission - record commission", () => {
    it("should record commission successfully", async () => {
      const mockCommissionResult: CommissionRecordResult = {
        commission_id: "comm-1",
        partner_id: "partner-1",
        partner_number: "PTR-001",
        partner_name: "Partner Company",
        customer_id: "cust-1",
        commission_type: "new_customer",
        amount: "1500.00",
        currency: "USD",
        status: "pending",
        event_date: "2024-01-20T00:00:00Z",
        partner_balance: "15000.00",
        partner_outstanding_balance: "5000.00",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockCommissionResult,
      });

      const { result } = renderHook(() => useRecordCommission(), {
        wrapper: createWrapper(),
      });

      const commissionData: CommissionRecordInput = {
        partner_id: "partner-1",
        customer_id: "cust-1",
        commission_type: "new_customer",
        amount: 1500.0,
      };

      let commissionResult: CommissionRecordResult | undefined;
      await act(async () => {
        commissionResult = await result.current.mutateAsync(commissionData);
      });

      expect(commissionResult).toEqual(mockCommissionResult);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/partners/partner-1/commissions"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should handle all commission types", async () => {
      const commissionTypes: CommissionRecordInput["commission_type"][] = [
        "new_customer",
        "renewal",
        "upgrade",
        "usage",
        "referral",
      ];

      for (const commissionType of commissionTypes) {
        const mockResult: CommissionRecordResult = {
          commission_id: `comm-${commissionType}`,
          partner_id: "partner-1",
          partner_number: "PTR-001",
          partner_name: "Partner Company",
          customer_id: "cust-1",
          commission_type: commissionType,
          amount: "1000.00",
          currency: "USD",
          status: "pending",
          event_date: "2024-01-20T00:00:00Z",
          partner_balance: "15000.00",
          partner_outstanding_balance: "5000.00",
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => mockResult,
        });

        const { result } = renderHook(() => useRecordCommission(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            partner_id: "partner-1",
            customer_id: "cust-1",
            commission_type: commissionType,
            amount: 1000.0,
          });
        });

        expect(global.fetch).toHaveBeenCalled();

        jest.clearAllMocks();
      }
    });
  });

  describe("useCompletePartnerOnboarding - complete onboarding", () => {
    it("should complete partner onboarding successfully", async () => {
      const mockOnboardingResult: PartnerOnboardingResult = {
        partner: {
          id: "partner-new",
          partner_number: "PTR-002",
          company_name: "New Partner",
          status: "active",
          tier: "gold",
          commission_model: "revenue_share",
          primary_email: "new@partner.com",
          total_customers: 1,
          total_revenue_generated: 0,
          total_commissions_earned: 0,
          total_commissions_paid: 0,
          total_referrals: 0,
          converted_referrals: 0,
          created_at: "2024-01-20T00:00:00Z",
          updated_at: "2024-01-20T00:00:00Z",
        },
        customer: {
          customer_id: "cust-1",
          customer_number: "CUST-001",
          name: "John Doe",
          email: "john@example.com",
          tier: "premium",
          partner_id: "partner-new",
          partner_number: "PTR-002",
          partner_name: "New Partner",
          partner_account_id: "acc-1",
          engagement_type: "managed",
          commission_rate: "15.0",
          quota_remaining: 49,
          created_at: "2024-01-20T00:00:00Z",
        },
        licenses: {
          partner_id: "partner-new",
          partner_name: "New Partner",
          customer_id: "cust-1",
          licenses_allocated: 5,
          license_keys: ["KEY-1"],
          license_ids: ["lic-1"],
          template_id: "tmpl-1",
          template_name: "Enterprise License",
          product_id: "prod-1",
          quota_before: 50,
          quota_after: 45,
          quota_remaining: 45,
          allocated_at: "2024-01-20T00:00:00Z",
          status: "active",
          engagement_type: "managed",
        },
        tenant: {
          tenant_url: "https://tenant1.example.com",
          tenant_id: 1,
          instance_id: "inst-1",
          deployment_type: "dedicated",
          partner_id: "partner-new",
          partner_number: "PTR-002",
          partner_name: "New Partner",
          white_label_applied: true,
          engagement_type: "managed",
          status: "active",
          allocated_resources: {
            cpu: 4,
            memory_gb: 16,
            storage_gb: 500,
          },
          endpoints: {
            api: "https://api.tenant1.example.com",
            web: "https://tenant1.example.com",
          },
          provisioned_at: "2024-01-20T00:00:00Z",
        },
        workflow_id: "wf-1",
        status: "completed",
        completed_at: "2024-01-20T00:10:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockOnboardingResult,
      });

      const { result } = renderHook(() => useCompletePartnerOnboarding(), {
        wrapper: createWrapper(),
      });

      const onboardingData: PartnerOnboardingInput = {
        partner_data: {
          company_name: "New Partner",
          primary_email: "new@partner.com",
          tier: "gold",
          commission_model: "revenue_share",
        },
        customer_data: {
          first_name: "John",
          last_name: "Doe",
          email: "john@example.com",
        },
        license_template_id: "tmpl-1",
        deployment_type: "dedicated",
      };

      let onboardingResult: PartnerOnboardingResult | undefined;
      await act(async () => {
        onboardingResult = await result.current.mutateAsync(onboardingData);
      });

      expect(onboardingResult).toEqual(mockOnboardingResult);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/partners/onboarding/complete"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should invalidate all related queries after onboarding", async () => {
      const mockOnboardingResult: PartnerOnboardingResult = {
        partner: {
          id: "partner-new",
          partner_number: "PTR-002",
          company_name: "New Partner",
          status: "active",
          tier: "gold",
          commission_model: "revenue_share",
          primary_email: "new@partner.com",
          total_customers: 1,
          total_revenue_generated: 0,
          total_commissions_earned: 0,
          total_commissions_paid: 0,
          total_referrals: 0,
          converted_referrals: 0,
          created_at: "2024-01-20T00:00:00Z",
          updated_at: "2024-01-20T00:00:00Z",
        },
        customer: {
          customer_id: "cust-1",
          customer_number: "CUST-001",
          name: "John Doe",
          email: "john@example.com",
          tier: "premium",
          partner_id: "partner-new",
          partner_number: "PTR-002",
          partner_name: "New Partner",
          partner_account_id: "acc-1",
          engagement_type: "managed",
          commission_rate: "15.0",
          quota_remaining: 49,
          created_at: "2024-01-20T00:00:00Z",
        },
        licenses: {
          partner_id: "partner-new",
          partner_name: "New Partner",
          customer_id: "cust-1",
          licenses_allocated: 5,
          license_keys: ["KEY-1"],
          license_ids: ["lic-1"],
          template_id: "tmpl-1",
          template_name: "Enterprise License",
          product_id: "prod-1",
          quota_before: 50,
          quota_after: 45,
          quota_remaining: 45,
          allocated_at: "2024-01-20T00:00:00Z",
          status: "active",
          engagement_type: "managed",
        },
        tenant: {
          tenant_url: "https://tenant1.example.com",
          tenant_id: 1,
          instance_id: "inst-1",
          deployment_type: "dedicated",
          partner_id: "partner-new",
          partner_number: "PTR-002",
          partner_name: "New Partner",
          white_label_applied: true,
          engagement_type: "managed",
          status: "active",
          allocated_resources: {
            cpu: 4,
            memory_gb: 16,
            storage_gb: 500,
          },
          endpoints: {
            api: "https://api.tenant1.example.com",
            web: "https://tenant1.example.com",
          },
          provisioned_at: "2024-01-20T00:00:00Z",
        },
        workflow_id: "wf-1",
        status: "completed",
        completed_at: "2024-01-20T00:10:00Z",
      };

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Mock initial fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          partners: [],
          total: 0,
          page: 1,
          page_size: 50,
        }),
      });

      const { result: partnersResult } = renderHook(() => usePartners(), { wrapper });
      await waitFor(() => expect(partnersResult.current.isLoading).toBe(false));

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Mock onboarding
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOnboardingResult,
      });

      // Mock refetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          partners: [mockOnboardingResult.partner],
          total: 1,
          page: 1,
          page_size: 50,
        }),
      });

      const { result: onboardingResult } = renderHook(
        () => useCompletePartnerOnboarding(),
        { wrapper }
      );

      await act(async () => {
        await onboardingResult.current.mutateAsync({
          partner_data: {
            company_name: "New Partner",
            primary_email: "new@partner.com",
          },
          customer_data: {
            first_name: "John",
            last_name: "Doe",
            email: "john@example.com",
          },
          license_template_id: "tmpl-1",
          deployment_type: "dedicated",
        });
      });

      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle onboarding error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ detail: "Onboarding workflow failed" }),
      });

      const { result } = renderHook(() => useCompletePartnerOnboarding(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            partner_data: {
              company_name: "New Partner",
              primary_email: "new@partner.com",
            },
            customer_data: {
              first_name: "John",
              last_name: "Doe",
              email: "john@example.com",
            },
            license_template_id: "tmpl-1",
            deployment_type: "dedicated",
          });
        })
      ).rejects.toThrow();
    });
  });

  describe("Query key management", () => {
    it("should use correct query key for usePartners", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          partners: [],
          total: 0,
          page: 1,
          page_size: 50,
        }),
      });

      const { result } = renderHook(() => usePartners("active", 2, 25), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });

    it("should use correct query key for usePartner", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "partner-1",
          partner_number: "PTR-001",
          company_name: "Partner",
          status: "active",
          tier: "gold",
          commission_model: "revenue_share",
          primary_email: "partner@example.com",
          total_customers: 0,
          total_revenue_generated: 0,
          total_commissions_earned: 0,
          total_commissions_paid: 0,
          total_referrals: 0,
          converted_referrals: 0,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        }),
      });

      const { result } = renderHook(() => usePartner("partner-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });
  });

  describe("Loading states", () => {
    it("should show loading state during query fetch", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    partners: [],
                    total: 0,
                    page: 1,
                    page_size: 50,
                  }),
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => usePartners(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should show loading state during mutation", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({}),
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useCreatePartner(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate({
          company_name: "New Partner",
          primary_email: "new@partner.com",
        });
      });

      await waitFor(() => expect(result.current.isPending).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 200 });
    });
  });
});
