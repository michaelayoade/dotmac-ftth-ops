/**
 * Jest tests for useCustomerPortal hooks
 * Tests customer portal operations with Jest mocks
 */

// Mock portalAuthFetch BEFORE any imports that use it
// Create mock inside factory to avoid Jest hoisting issues
const mockFetchInstance = jest.fn();

jest.mock("../../../../shared/utils/operatorAuth", () => {
  const mockFn = jest.fn();
  return {
    createPortalAuthFetch: jest.fn().mockReturnValue(mockFn),
    CUSTOMER_PORTAL_TOKEN_KEY: "customer_token",
    PortalAuthError: class extends Error {},
    __getMockFetch: () => mockFn, // Helper to get the mock
  };
});

// Mock AppConfigContext
jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      baseUrl: "https://api.example.com",
      prefix: "/api/v1",
      buildUrl: (path: string) => {
        const normalized = path.startsWith("/") ? path : `/${path}`;
        const prefixed = normalized.startsWith("/api/v1") ? normalized : `/api/v1${normalized}`;
        return `https://api.example.com${prefixed}`;
      },
    },
    features: {},
    branding: {},
    tenant: {},
  }),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useCustomerProfile,
  useCustomerService,
  useCustomerInvoices,
  useCustomerPayments,
  useCustomerUsage,
  useCustomerTickets,
  useCustomerSettings,
  useCustomerPaymentMethods,
} from "../useCustomerPortal";
import * as operatorAuthModule from "../../../../shared/utils/operatorAuth";

// Import MSW server
const { server } = require("../../__tests__/msw/server");

// Get the mock fetch instance
const mockPortalFetch = (operatorAuthModule as any).__getMockFetch();

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

describe("useCustomerPortal", () => {
  beforeAll(() => {
    // Stop MSW server for this test suite since we're using Jest mocks
    server.close();
  });

  afterAll(() => {
    // Restart MSW server after this test suite
    server.listen({ onUnhandledRequest: "warn" });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPortalFetch.mockReset();
  });

  describe("useCustomerProfile", () => {
    it("should fetch customer profile", async () => {
      const mockProfile = {
        id: "profile-1",
        customer_id: "cust-1",
        account_number: "ACC-001",
        first_name: "Jane",
        last_name: "Smith",
        email: "jane@example.com",
        phone: "+1234567890",
        service_address: "456 Oak St",
        service_city: "Springfield",
        service_state: "IL",
        service_zip: "62701",
        status: "active",
      };

      mockPortalFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProfile,
      });

      const { result } = renderHook(() => useCustomerProfile(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.profile).not.toBeNull());

      expect(result.current.profile?.first_name).toBe("Jane");
      expect(result.current.profile?.last_name).toBe("Smith");
      expect(result.current.profile?.email).toBe("jane@example.com");
    });

    it("should update customer profile", async () => {
      const mockProfile = {
        id: "profile-1",
        customer_id: "cust-1",
        account_number: "ACC-001",
        first_name: "Jane",
        last_name: "Smith",
        email: "jane@example.com",
        phone: "+9876543210",
        service_address: "456 Oak St",
        service_city: "Springfield",
        service_state: "IL",
        service_zip: "62701",
        status: "active",
      };

      mockPortalFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockProfile, phone: "+1234567890" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProfile,
        });

      const { result } = renderHook(() => useCustomerProfile(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.profile).not.toBeNull());

      await act(async () => {
        await result.current.updateProfile({ phone: "+9876543210" } as any);
      });

      await waitFor(() => expect(result.current.isUpdating).toBe(false));
    });
  });

  describe("useCustomerInvoices", () => {
    it("should fetch invoices", async () => {
      const mockInvoices = [
        {
          invoice_id: "inv-1",
          invoice_number: "INV-001",
          amount: 79.99,
          amount_due: 79.99,
          amount_paid: 0,
          status: "finalized",
          due_date: "2024-02-01",
          created_at: "2024-01-01",
          description: "Monthly service",
          line_items: [
            {
              description: "Premium Plan",
              quantity: 1,
              unit_price: 79.99,
              total_price: 79.99,
            },
          ],
        },
      ];

      mockPortalFetch.mockResolvedValue({
        ok: true,
        json: async () => mockInvoices,
      });

      const { result } = renderHook(() => useCustomerInvoices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.invoices.length).toBeGreaterThan(0));

      expect(result.current.invoices[0].invoice_number).toBe("INV-001");
      expect(result.current.invoices[0].amount).toBe(79.99);
    });
  });

  describe("useCustomerPaymentMethods", () => {
    it("should fetch payment methods", async () => {
      const mockMethods = [
        {
          payment_method_id: "pm-1",
          method_type: "card",
          status: "active",
          is_default: true,
          card_brand: "visa",
          card_last4: "4242",
          card_exp_month: 12,
          card_exp_year: 2025,
          billing_name: "Jane Smith",
          billing_email: "jane@example.com",
          is_verified: true,
          created_at: "2024-01-01T00:00:00Z",
          auto_pay_enabled: false,
        },
      ];

      mockPortalFetch.mockResolvedValue({
        ok: true,
        json: async () => mockMethods,
      });

      const { result } = renderHook(() => useCustomerPaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.paymentMethods.length).toBeGreaterThan(0));

      expect(result.current.paymentMethods[0].card_last4).toBe("4242");
      expect(result.current.defaultPaymentMethod?.payment_method_id).toBe("pm-1");
    });

    it("should add payment method", async () => {
      const newMethod = {
        payment_method_id: "pm-new",
        method_type: "card",
        status: "active",
        is_default: false,
        card_brand: "mastercard",
        card_last4: "5555",
        card_exp_month: 6,
        card_exp_year: 2026,
        billing_name: "John Doe",
        billing_email: "john@example.com",
        is_verified: true,
        created_at: "2024-01-01T00:00:00Z",
        auto_pay_enabled: false,
      };

      mockPortalFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => newMethod,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [newMethod],
        });

      const { result } = renderHook(() => useCustomerPaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.paymentMethods).toBeDefined());

      let addedMethod;
      await act(async () => {
        addedMethod = await result.current.addPaymentMethod({
          method_type: "card",
          card_brand: "mastercard",
          card_last4: "5555",
          card_exp_month: 6,
          card_exp_year: 2026,
          billing_name: "John Doe",
          billing_email: "john@example.com",
        });
      });

      expect(addedMethod).toBeDefined();
      expect((addedMethod as any).card_last4).toBe("5555");
    });
  });
});
