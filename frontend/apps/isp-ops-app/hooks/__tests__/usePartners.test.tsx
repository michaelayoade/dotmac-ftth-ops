/**
 * Jest Mock Tests for usePartners hook
 * Tests partner management system with Jest mocks
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
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

// Mock the AppConfigContext
jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
    },
  }),
}));

// Mock fetch
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Import MSW server to disable it
import { server } from "@/__tests__/msw/server";

describe("usePartners (Jest Mocks)", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeAll(() => {
    server.resetHandlers();
    server.close();
  });

  afterAll(() => {
    server.listen();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Partner Management", () => {
    describe("usePartners", () => {
      it("should fetch partners successfully", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            partners: [
              { id: "partner-1", company_name: "Partner One", status: "active" },
              { id: "partner-2", company_name: "Partner Two", status: "active" },
            ],
            total: 2,
          }),
        } as Response);

        const { result } = renderHook(() => usePartners(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.partners).toHaveLength(2);
        expect(result.current.data?.total).toBe(2);
      });

      it("should filter partners by status", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            partners: [
              { id: "partner-1", status: "active" },
              { id: "partner-2", status: "active" },
            ],
            total: 2,
          }),
        } as Response);

        const { result } = renderHook(() => usePartners("active"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.partners).toHaveLength(2);
      });
    });

    describe("usePartner", () => {
      it("should fetch single partner successfully", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "partner-123",
            company_name: "Test Partner",
            primary_email: "test@partner.com",
          }),
        } as Response);

        const { result } = renderHook(() => usePartner("partner-123"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.id).toBe("partner-123");
        expect(result.current.data?.company_name).toBe("Test Partner");
      });

      it("should not fetch when id is undefined", () => {
        const { result } = renderHook(() => usePartner(undefined), {
          wrapper: createWrapper(),
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.fetchStatus).toBe("idle");
      });
    });

    describe("useCreatePartner", () => {
      it("should create partner successfully", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "partner-new",
            company_name: "New Partner",
            status: "pending",
          }),
        } as Response);

        const { result } = renderHook(() => useCreatePartner(), {
          wrapper: createWrapper(),
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
      });
    });
  });

  describe("Workflow Operations", () => {
    describe("useCheckLicenseQuota", () => {
      it("should check quota successfully", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            available: true,
            can_allocate: true,
            quota_remaining: 100,
          }),
        } as Response);

        const { result } = renderHook(() => useCheckLicenseQuota(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            partnerId: "partner-123",
            requestedLicenses: 10,
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.available).toBe(true);
      });
    });

    describe("useCompletePartnerOnboarding", () => {
      it("should complete onboarding workflow", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            partner: { id: "partner-new", company_name: "New Partner" },
            customer: { customer_id: "customer-new", name: "First Customer" },
            licenses: { licenses_allocated: 5 },
            tenant: { tenant_id: 1, tenant_url: "https://tenant.example.com" },
            commission: { commission_id: "comm-1" },
            status: "completed",
            workflow_id: "workflow-1",
          }),
        } as Response);

        const { result } = renderHook(() => useCompletePartnerOnboarding(), {
          wrapper: createWrapper(),
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
        expect(result.current.data?.status).toBe("completed");
      });
    });
  });
});
