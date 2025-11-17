/**
 * MSW-based tests for useCustomerPortal hooks
 * Tests customer portal operations with realistic API mocking
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
import {
  clearCustomerPortalData,
  seedCustomerPortalProfile,
  seedCustomerPortalService,
  seedCustomerPortalInvoices,
  seedCustomerPortalPayments,
  seedCustomerPortalUsage,
  seedCustomerPortalTickets,
  seedCustomerPortalSettings,
  seedCustomerPortalPaymentMethods,
} from "@/__tests__/msw/handlers/customer-portal";
import { createTestQueryClient } from "@/__tests__/test-utils";

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock AppConfigContext
const buildUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const prefixed = normalized.startsWith("/api/v1") ? normalized : `/api/v1${normalized}`;
  return `https://api.example.com${prefixed}`;
};

jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      baseUrl: "https://api.example.com",
      prefix: "/api/v1",
      buildUrl,
    },
    features: {},
    branding: {},
    tenant: {},
  }),
}));

// Mock customerPortalFetch to use actual fetch (intercepted by MSW)
jest.mock("../../../../shared/utils/operatorAuth", () => ({
  createPortalAuthFetch: () => (url: string, options?: any) => fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      "Content-Type": "application/json",
    },
  }),
  CUSTOMER_PORTAL_TOKEN_KEY: "customer_token",
  PortalAuthError: class extends Error {},
}));

const createWrapper = () => {
  const queryClient = createTestQueryClient();

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Helper to ensure refetch re-renders complete within act()
const runRefetch = async (refetch: () => unknown) => {
  await act(async () => {
    await Promise.resolve(refetch());
  });
};

describe("useCustomerPortal", () => {
  beforeEach(() => {
    clearCustomerPortalData();
  });

  describe("useCustomerProfile", () => {
    it("should fetch customer profile", async () => {
      seedCustomerPortalProfile({
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
      seedCustomerPortalProfile({
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
      });

      const { result } = renderHook(() => useCustomerProfile(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.profile).not.toBeNull());

      await act(async () => {
        await result.current.updateProfile({ phone: "+9876543210" } as any);
      });

      await waitFor(() => expect(result.current.isUpdating).toBe(false));
      await waitFor(() => expect(result.current.profile?.phone).toBe("+9876543210"));
    });
  });

  describe("useCustomerService", () => {
    it("should fetch customer service", async () => {
      seedCustomerPortalService({
        id: "service-1",
        plan_name: "Premium Plan",
        plan_id: "plan-premium",
        speed_down: "1 Gbps",
        speed_up: "100 Mbps",
        monthly_price: 79.99,
        installation_date: "2024-01-01",
        billing_cycle: "monthly",
        next_billing_date: "2024-02-01",
        status: "active",
      });

      const { result } = renderHook(() => useCustomerService(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.service).not.toBeNull());

      expect(result.current.service?.plan_name).toBe("Premium Plan");
      expect(result.current.service?.speed_down).toBe("1 Gbps");
    });

    it("should upgrade plan", async () => {
      seedCustomerPortalService({
        id: "service-1",
        plan_name: "Basic Plan",
        plan_id: "plan-basic",
        speed_down: "100 Mbps",
        speed_up: "10 Mbps",
        monthly_price: 49.99,
        installation_date: "2024-01-01",
        billing_cycle: "monthly",
        next_billing_date: "2024-02-01",
        status: "active",
      });

      const { result } = renderHook(() => useCustomerService(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.service).not.toBeNull());

      await act(async () => {
        await result.current.upgradePlan("plan-premium");
      });

      await waitFor(() => expect(result.current.isUpgrading).toBe(false));
      await waitFor(() => expect(result.current.service?.plan_id).toBe("plan-premium"));
    });
  });

  describe("useCustomerInvoices", () => {
    it("should fetch invoices", async () => {
      seedCustomerPortalInvoices([
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
      ]);

      const { result } = renderHook(() => useCustomerInvoices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.invoices.length).toBeGreaterThan(0));

      expect(result.current.invoices[0].invoice_number).toBe("INV-001");
      expect(result.current.invoices[0].amount).toBe(79.99);
    });
  });

  describe("useCustomerPayments", () => {
    it("should fetch payments", async () => {
      seedCustomerPortalPayments([
        {
          id: "pay-1",
          amount: 79.99,
          date: "2024-01-15",
          method: "card",
          invoice_number: "INV-001",
          status: "success",
        },
      ]);

      const { result } = renderHook(() => useCustomerPayments(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.payments.length).toBeGreaterThan(0));

      expect(result.current.payments[0].amount).toBe(79.99);
      expect(result.current.payments[0].status).toBe("success");
    });

    it("should make payment", async () => {
      const { result } = renderHook(() => useCustomerPayments(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.makePayment({
          invoiceId: "inv-1",
          amount: 79.99,
          paymentMethodId: "pm-1",
        });
      });

      await waitFor(() => expect(result.current.isProcessingPayment).toBe(false));
      await waitFor(() => expect(result.current.payments.length).toBeGreaterThan(0));
    });
  });

  describe("useCustomerUsage", () => {
    it("should fetch usage", async () => {
      seedCustomerPortalUsage({
        upload_gb: 100,
        download_gb: 400,
        total_gb: 500,
        limit_gb: 1000,
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
      });

      const { result } = renderHook(() => useCustomerUsage(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.usage).not.toBeNull());

      expect(result.current.usage?.total_gb).toBe(500);
      expect(result.current.usage?.limit_gb).toBe(1000);
    });
  });

  describe("useCustomerTickets", () => {
    it("should fetch tickets", async () => {
      seedCustomerPortalTickets([
        {
          id: "ticket-1",
          ticket_number: "T-00001",
          subject: "Connection issue",
          description: "Slow internet",
          status: "open",
          priority: "high",
          category: "technical",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ]);

      const { result } = renderHook(() => useCustomerTickets(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.tickets.length).toBeGreaterThan(0));

      expect(result.current.tickets[0].subject).toBe("Connection issue");
      expect(result.current.tickets[0].status).toBe("open");
    });

    it("should create ticket", async () => {
      const { result } = renderHook(() => useCustomerTickets(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.createTicket({
          subject: "Billing question",
          description: "Need clarification on invoice",
          category: "billing",
          priority: "normal",
        });
      });

      await waitFor(() => expect(result.current.isCreatingTicket).toBe(false));
      await waitFor(() => expect(result.current.tickets.length).toBeGreaterThan(0));
    });
  });

  describe("useCustomerSettings", () => {
    it("should fetch settings", async () => {
      seedCustomerPortalSettings({
        notifications_enabled: true,
        email_notifications: true,
        sms_notifications: true,
        auto_pay_enabled: true,
      });

      const { result } = renderHook(() => useCustomerSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.settings).not.toBeNull());

      expect(result.current.settings.notifications_enabled).toBe(true);
      expect(result.current.settings.auto_pay_enabled).toBe(true);
    });

    it("should update settings", async () => {
      seedCustomerPortalSettings({
        notifications_enabled: true,
        email_notifications: true,
        sms_notifications: false,
        auto_pay_enabled: false,
      });

      const { result } = renderHook(() => useCustomerSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.settings).not.toBeNull());

      await act(async () => {
        await result.current.updateSettings({ sms_notifications: true });
      });

      await waitFor(() => expect(result.current.isUpdatingSettings).toBe(false));
      await waitFor(() => expect(result.current.settings.sms_notifications).toBe(true));
    });

    it("should change password", async () => {
      seedCustomerPortalSettings({
        notifications_enabled: true,
        email_notifications: true,
        sms_notifications: false,
        auto_pay_enabled: false,
      });

      const { result } = renderHook(() => useCustomerSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.settings).not.toBeNull());

      let passwordResult;
      await act(async () => {
        passwordResult = await result.current.changePassword({
          currentPassword: "oldpass",
          newPassword: "newpass123",
        });
      });

      await waitFor(() => expect(result.current.isChangingPassword).toBe(false));
      expect(passwordResult).toBeDefined();
    });
  });

  describe("useCustomerPaymentMethods", () => {
    it("should fetch payment methods", async () => {
      seedCustomerPortalPaymentMethods([
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
      ]);

      const { result } = renderHook(() => useCustomerPaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.paymentMethods.length).toBeGreaterThan(0));

      expect(result.current.paymentMethods[0].card_last4).toBe("4242");
      expect(result.current.defaultPaymentMethod?.payment_method_id).toBe("pm-1");
    });

    it("should add payment method", async () => {
      const { result } = renderHook(() => useCustomerPaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

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

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(addedMethod).toBeDefined();
      await waitFor(() => expect(result.current.paymentMethods.length).toBeGreaterThan(0));
    });

    it("should set default payment method", async () => {
      seedCustomerPortalPaymentMethods([
        {
          payment_method_id: "pm-1",
          method_type: "card",
          status: "active",
          is_default: true,
          card_brand: "visa",
          card_last4: "4242",
          created_at: "2024-01-01T00:00:00Z",
          auto_pay_enabled: false,
        },
        {
          payment_method_id: "pm-2",
          method_type: "card",
          status: "active",
          is_default: false,
          card_brand: "mastercard",
          card_last4: "5555",
          created_at: "2024-01-02T00:00:00Z",
          auto_pay_enabled: false,
        },
      ]);

      const { result } = renderHook(() => useCustomerPaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.paymentMethods.length).toBe(2));

      await act(async () => {
        await result.current.setDefaultPaymentMethod("pm-2");
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      await waitFor(() => expect(result.current.defaultPaymentMethod?.payment_method_id).toBe("pm-2"));
    });

    it("should remove payment method", async () => {
      seedCustomerPortalPaymentMethods([
        {
          payment_method_id: "pm-1",
          method_type: "card",
          status: "active",
          is_default: true,
          card_brand: "visa",
          card_last4: "4242",
          created_at: "2024-01-01T00:00:00Z",
          auto_pay_enabled: false,
        },
      ]);

      const { result } = renderHook(() => useCustomerPaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.paymentMethods.length).toBe(1));

      await act(async () => {
        await result.current.removePaymentMethod("pm-1");
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      await waitFor(() => expect(result.current.paymentMethods.length).toBe(0));
    });

    it("should toggle auto pay", async () => {
      seedCustomerPortalPaymentMethods([
        {
          payment_method_id: "pm-1",
          method_type: "card",
          status: "active",
          is_default: true,
          card_brand: "visa",
          card_last4: "4242",
          created_at: "2024-01-01T00:00:00Z",
          auto_pay_enabled: false,
        },
      ]);

      const { result } = renderHook(() => useCustomerPaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.paymentMethods.length).toBe(1));

      await act(async () => {
        await result.current.toggleAutoPay("pm-1", true);
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      await waitFor(() => expect(result.current.autoPayPaymentMethod?.payment_method_id).toBe("pm-1"));
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle complete customer journey - profile update to payment", async () => {
      // Seed initial data
      seedCustomerPortalProfile({
        id: "profile-journey",
        customer_id: "cust-journey",
        first_name: "Alice",
        last_name: "Johnson",
        email: "alice@example.com",
        phone: "+1234567890",
      });

      seedCustomerPortalInvoices([
        {
          invoice_id: "inv-journey-1",
          invoice_number: "INV-JOURNEY-001",
          amount: 99.99,
          amount_due: 99.99,
          amount_paid: 0,
          status: "finalized",
        },
      ]);

      // Create a shared wrapper for this test
      const wrapper = createWrapper();

      // Step 1: Load profile
      const { result: profileResult } = renderHook(() => useCustomerProfile(), {
        wrapper,
      });

      await waitFor(() => expect(profileResult.current.profile).not.toBeNull());
      expect(profileResult.current.profile?.first_name).toBe("Alice");

      // Step 2: Update profile
      await act(async () => {
        await profileResult.current.updateProfile({
          phone: "+9998887777",
        } as any);
      });

      await waitFor(() => expect(profileResult.current.isUpdating).toBe(false));
      await runRefetch(profileResult.current.refetch);
      await waitFor(() => expect(profileResult.current.profile?.phone).toBe("+9998887777"));

      // Step 3: Add payment method
      const { result: paymentMethodsResult } = renderHook(
        () => useCustomerPaymentMethods(),
        { wrapper }
      );

      await waitFor(() => expect(paymentMethodsResult.current.loading).toBe(false));

      await act(async () => {
        await paymentMethodsResult.current.addPaymentMethod({
          method_type: "card",
          card_brand: "visa",
          card_last4: "1234",
          card_exp_month: 12,
          card_exp_year: 2026,
          billing_name: "Alice Johnson",
        });
      });

      await waitFor(() => expect(paymentMethodsResult.current.loading).toBe(false));
      expect(paymentMethodsResult.current.paymentMethods.length).toBeGreaterThan(0);

      // Step 4: Make payment
      const { result: paymentsResult } = renderHook(() => useCustomerPayments(), {
        wrapper,
      });

      await waitFor(() => expect(paymentsResult.current.loading).toBe(false));

      await act(async () => {
        await paymentsResult.current.makePayment({
          invoiceId: "inv-journey-1",
          amount: 99.99,
          paymentMethodId: paymentMethodsResult.current.paymentMethods[0].payment_method_id,
        });
      });

      await waitFor(() => expect(paymentsResult.current.isProcessingPayment).toBe(false));
      expect(paymentsResult.current.payments.length).toBeGreaterThan(0);
      expect(paymentsResult.current.payments[0].status).toBe("success");
    });

    it("should handle service upgrade and settings update workflow", async () => {
      // Seed initial service data
      seedCustomerPortalService({
        id: "service-upgrade",
        plan_name: "Basic Plan",
        plan_id: "plan-basic",
        speed_down: "100 Mbps",
        monthly_price: 49.99,
      });

      seedCustomerPortalSettings({
        notifications_enabled: false,
        email_notifications: false,
        sms_notifications: false,
        auto_pay_enabled: false,
      });

      // Create a shared wrapper for this test
      const wrapper = createWrapper();

      // Step 1: Upgrade service
      const { result: serviceResult } = renderHook(() => useCustomerService(), {
        wrapper,
      });

      await waitFor(() => expect(serviceResult.current.service).not.toBeNull());
      expect(serviceResult.current.service?.plan_name).toBe("Basic Plan");

      await act(async () => {
        await serviceResult.current.upgradePlan("plan-premium");
      });

      await waitFor(() => expect(serviceResult.current.isUpgrading).toBe(false));
      await waitFor(() => expect(serviceResult.current.service?.plan_id).toBe("plan-premium"));

      // Step 2: Enable notifications after upgrade
      const { result: settingsResult } = renderHook(() => useCustomerSettings(), {
        wrapper,
      });

      await waitFor(() => expect(settingsResult.current.settings).not.toBeNull());

      await act(async () => {
        await settingsResult.current.updateSettings({
          notifications_enabled: true,
          email_notifications: true,
          sms_notifications: true,
        });
      });

      await waitFor(() => expect(settingsResult.current.isUpdatingSettings).toBe(false));
      await runRefetch(settingsResult.current.refetch);
      await waitFor(() => expect(settingsResult.current.settings.notifications_enabled).toBe(true));
      await waitFor(() => expect(settingsResult.current.settings.email_notifications).toBe(true));
      await waitFor(() => expect(settingsResult.current.settings.sms_notifications).toBe(true));
    });

    it("should handle support ticket lifecycle", async () => {
      // Create a ticket
      const { result } = renderHook(() => useCustomerTickets(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Create first ticket
      await act(async () => {
        await result.current.createTicket({
          subject: "Internet connection issue",
          description: "Internet keeps disconnecting",
          category: "technical",
          priority: "high",
        });
      });

      await waitFor(() => expect(result.current.isCreatingTicket).toBe(false));
      await waitFor(() => expect(result.current.tickets.length).toBe(1));
      expect(result.current.tickets[0].priority).toBe("high");

      // Create second ticket
      await act(async () => {
        await result.current.createTicket({
          subject: "Billing inquiry",
          description: "Question about recent charges",
          category: "billing",
          priority: "normal",
        });
      });

      await waitFor(() => expect(result.current.isCreatingTicket).toBe(false));
      await waitFor(() => expect(result.current.tickets.length).toBe(2));
    });

    it("should handle payment method management workflow", async () => {
      // Start with one payment method
      seedCustomerPortalPaymentMethods([
        {
          payment_method_id: "pm-existing",
          method_type: "card",
          status: "active",
          is_default: true,
          card_brand: "visa",
          card_last4: "4242",
          auto_pay_enabled: false,
        },
      ]);

      const { result } = renderHook(() => useCustomerPaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.paymentMethods.length).toBe(1));
      expect(result.current.defaultPaymentMethod?.payment_method_id).toBe("pm-existing");

      // Add new payment method
      await act(async () => {
        await result.current.addPaymentMethod({
          method_type: "card",
          card_brand: "mastercard",
          card_last4: "5555",
          card_exp_month: 6,
          card_exp_year: 2027,
          billing_name: "John Doe",
        });
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      await waitFor(() => expect(result.current.paymentMethods.length).toBe(2));

      // Set new method as default
      const newMethodId = result.current.paymentMethods.find((pm) => pm.card_last4 === "5555")
        ?.payment_method_id;
      expect(newMethodId).toBeDefined();

      await act(async () => {
        await result.current.setDefaultPaymentMethod(newMethodId!);
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.defaultPaymentMethod?.payment_method_id).toBe(newMethodId);

      // Enable auto-pay on default method
      await act(async () => {
        await result.current.toggleAutoPay(newMethodId!, true);
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.autoPayPaymentMethod?.payment_method_id).toBe(newMethodId);

      // Remove old payment method
      await act(async () => {
        await result.current.removePaymentMethod("pm-existing");
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.paymentMethods.length).toBe(1);
      expect(result.current.paymentMethods[0].payment_method_id).toBe(newMethodId);
    });
  });
});
