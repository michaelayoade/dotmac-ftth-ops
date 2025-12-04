/**
 * @fileoverview Tests for useCustomerPortal hooks
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useCustomerProfile,
  useCustomerService,
  useCustomerInvoices,
  useCustomerPayments,
  useCustomerUsage,
  useCustomerTickets,
  useCustomerSettings,
  useCustomerPaymentMethods,
  customerPortalKeys,
} from "@/hooks/useCustomerPortal";
import {
  createTestQueryClient,
  createQueryWrapper,
  createMockCustomer,
  createMockService,
  createMockInvoice,
  createMockTicket,
  createMockUsageData,
  createFetchResponse,
} from "../test-utils";

// Mock the auth module
jest.mock("@/lib/auth", () => ({
  customerAuthFetch: jest.fn(),
  CustomerAuthError: class CustomerAuthError extends Error {
    constructor(message: string, public code: string = "AUTH_ERROR") {
      super(message);
      this.name = "CustomerAuthError";
    }
  },
}));

import { customerAuthFetch } from "@/lib/auth";

const mockCustomerAuthFetch = customerAuthFetch as jest.MockedFunction<typeof customerAuthFetch>;

describe("customerPortalKeys", () => {
  it("generates correct query keys", () => {
    expect(customerPortalKeys.all).toEqual(["customerPortal"]);
    expect(customerPortalKeys.profile()).toEqual(["customerPortal", "profile"]);
    expect(customerPortalKeys.service()).toEqual(["customerPortal", "service"]);
    expect(customerPortalKeys.invoices()).toEqual(["customerPortal", "invoices"]);
    expect(customerPortalKeys.payments()).toEqual(["customerPortal", "payments"]);
    expect(customerPortalKeys.paymentMethods()).toEqual(["customerPortal", "paymentMethods"]);
    expect(customerPortalKeys.usage()).toEqual(["customerPortal", "usage"]);
    expect(customerPortalKeys.tickets()).toEqual(["customerPortal", "tickets"]);
    expect(customerPortalKeys.settings()).toEqual(["customerPortal", "settings"]);
  });
});

describe("useCustomerProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches profile successfully", async () => {
    const mockProfile = createMockCustomer();
    mockCustomerAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProfile),
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerProfile(), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.error).toBeNull();
  });

  it("handles fetch error", async () => {
    mockCustomerAuthFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBe("Failed to fetch profile");
  });

  it("updates profile successfully", async () => {
    const mockProfile = createMockCustomer();
    const updatedProfile = { ...mockProfile, first_name: "Updated" };

    mockCustomerAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedProfile),
      } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateProfile({ first_name: "Updated" });
    });

    // The update should have been called
    expect(mockCustomerAuthFetch).toHaveBeenCalledTimes(2);
  });
});

describe("useCustomerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches service successfully", async () => {
    const mockService = createMockService();
    mockCustomerAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockService),
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerService(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.service).toEqual(mockService);
    expect(result.current.error).toBeNull();
  });

  it("handles fetch error", async () => {
    mockCustomerAuthFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerService(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.service).toBeNull();
    expect(result.current.error).toBe("Failed to fetch service");
  });
});

describe("useCustomerInvoices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches invoices successfully", async () => {
    const mockInvoices = [createMockInvoice(), createMockInvoice({ id: "inv-456" })];
    mockCustomerAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockInvoices),
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerInvoices(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.invoices).toEqual(mockInvoices);
    expect(result.current.error).toBeNull();
  });

  it("returns empty array on error", async () => {
    mockCustomerAuthFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerInvoices(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.invoices).toEqual([]);
  });
});

describe("useCustomerPayments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches payments successfully", async () => {
    const mockPayments = [
      { id: "pay-1", amount: 99.99, date: "2024-01-01", method: "card", invoice_number: "INV-001", status: "success" },
      { id: "pay-2", amount: 49.99, date: "2024-02-01", method: "card", invoice_number: "INV-002", status: "success" },
    ];
    mockCustomerAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPayments),
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerPayments(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.payments).toEqual(mockPayments);
  });

  it("makes payment successfully", async () => {
    const mockPayments: any[] = [];
    const newPayment = { id: "pay-new", amount: 100, date: "2024-03-01", method: "card", invoice_number: "INV-003", status: "success" };

    mockCustomerAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPayments),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newPayment),
      } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerPayments(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.makePayment({
        invoiceId: "inv-123",
        amount: 100,
        paymentMethodId: "pm-123",
      });
    });

    expect(mockCustomerAuthFetch).toHaveBeenCalledTimes(2);
  });
});

describe("useCustomerUsage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches usage successfully", async () => {
    const mockUsage = createMockUsageData();
    mockCustomerAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockUsage),
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerUsage(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.usage).toEqual(mockUsage);
  });

  it("returns null on error", async () => {
    mockCustomerAuthFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerUsage(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.usage).toBeNull();
  });
});

describe("useCustomerTickets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches tickets successfully", async () => {
    const mockTickets = [createMockTicket(), createMockTicket({ id: "ticket-456" })];
    mockCustomerAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTickets),
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerTickets(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tickets).toEqual(mockTickets);
  });

  it("creates ticket successfully", async () => {
    const mockTickets: any[] = [];
    const newTicket = createMockTicket({ id: "ticket-new" });

    mockCustomerAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTickets),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newTicket),
      } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerTickets(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.createTicket({
        subject: "Test ticket",
        description: "Test description",
        category: "technical",
        priority: "normal",
      });
    });

    expect(mockCustomerAuthFetch).toHaveBeenCalledTimes(2);
  });
});

describe("useCustomerSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches settings successfully", async () => {
    const mockSettings = { notifications: true, theme: "dark" };
    mockCustomerAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSettings),
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toEqual(mockSettings);
  });

  it("updates settings successfully", async () => {
    const mockSettings = { notifications: true };
    const updatedSettings = { notifications: false };

    mockCustomerAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSettings),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedSettings),
      } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateSettings({ notifications: false });
    });

    expect(mockCustomerAuthFetch).toHaveBeenCalledTimes(2);
  });

  it("changes password successfully", async () => {
    const mockSettings = {};

    mockCustomerAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSettings),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.changePassword({
        currentPassword: "oldpass",
        newPassword: "newpass",
      });
    });

    expect(mockCustomerAuthFetch).toHaveBeenCalledTimes(2);
  });
});

describe("useCustomerPaymentMethods", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockPaymentMethod = (overrides = {}) => ({
    payment_method_id: "pm-123",
    method_type: "card" as const,
    status: "active" as const,
    is_default: true,
    card_brand: "visa",
    card_last4: "4242",
    card_exp_month: 12,
    card_exp_year: 2025,
    created_at: new Date().toISOString(),
    auto_pay_enabled: false,
    ...overrides,
  });

  it("fetches payment methods successfully", async () => {
    const mockMethods = [
      createMockPaymentMethod(),
      createMockPaymentMethod({ payment_method_id: "pm-456", is_default: false }),
    ];
    mockCustomerAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMethods),
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerPaymentMethods(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.paymentMethods).toEqual(mockMethods);
    expect(result.current.defaultPaymentMethod).toEqual(mockMethods[0]);
  });

  it("identifies auto-pay payment method", async () => {
    const mockMethods = [
      createMockPaymentMethod({ auto_pay_enabled: true }),
    ];
    mockCustomerAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMethods),
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerPaymentMethods(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.autoPayPaymentMethod).toEqual(mockMethods[0]);
  });

  it("adds payment method successfully", async () => {
    const existingMethods = [createMockPaymentMethod()];
    const newMethod = createMockPaymentMethod({ payment_method_id: "pm-new", is_default: false });

    mockCustomerAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(existingMethods),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newMethod),
      } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerPaymentMethods(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addPaymentMethod({ card_number: "4242..." });
    });

    expect(mockCustomerAuthFetch).toHaveBeenCalledTimes(2);
  });

  it("sets default payment method", async () => {
    const mockMethods = [
      createMockPaymentMethod({ payment_method_id: "pm-1", is_default: true }),
      createMockPaymentMethod({ payment_method_id: "pm-2", is_default: false }),
    ];

    mockCustomerAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMethods),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockMethods[1], is_default: true }),
      } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerPaymentMethods(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.setDefaultPaymentMethod("pm-2");
    });

    expect(mockCustomerAuthFetch).toHaveBeenCalledTimes(2);
  });

  it("removes payment method", async () => {
    const mockMethods = [
      createMockPaymentMethod({ payment_method_id: "pm-1" }),
      createMockPaymentMethod({ payment_method_id: "pm-2", is_default: false }),
    ];

    mockCustomerAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMethods),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerPaymentMethods(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.removePaymentMethod("pm-2");
    });

    expect(mockCustomerAuthFetch).toHaveBeenCalledTimes(2);
  });

  it("toggles auto-pay", async () => {
    const mockMethods = [createMockPaymentMethod({ auto_pay_enabled: false })];

    mockCustomerAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMethods),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockMethods[0], auto_pay_enabled: true }),
      } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCustomerPaymentMethods(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.toggleAutoPay("pm-123");
    });

    expect(mockCustomerAuthFetch).toHaveBeenCalledTimes(2);
  });
});
