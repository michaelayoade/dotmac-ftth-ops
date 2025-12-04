"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerAuthFetch, CustomerAuthError } from "@/lib/auth";
import { customerConfig } from "@/lib/config";

const buildApiUrl = customerConfig.api.buildUrl;

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

const toMessage = (error: unknown, fallback: string) =>
  error instanceof CustomerAuthError
    ? error.message
    : error instanceof Error
      ? error.message
      : fallback;

// ============================================================================
// Types
// ============================================================================

export interface CustomerProfile {
  id: string;
  customer_id: string;
  account_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  service_address: string;
  service_city: string;
  service_state: string;
  service_zip: string;
  status: "active" | "suspended" | "cancelled";
}

export interface CustomerService {
  id: string;
  plan_name: string;
  plan_id: string;
  speed_down: string;
  speed_up: string;
  monthly_price: number;
  installation_date: string;
  billing_cycle: string;
  next_billing_date: string;
  status: "active" | "suspended" | "cancelled";
}

export interface CustomerInvoice {
  invoice_id: string;
  invoice_number: string;
  amount: number;
  amount_due: number;
  amount_paid: number;
  status: "draft" | "finalized" | "paid" | "void" | "uncollectible";
  due_date: string;
  paid_date?: string;
  created_at: string;
  description: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export interface CustomerPayment {
  id: string;
  amount: number;
  date: string;
  method: string;
  invoice_number: string;
  status: "success" | "pending" | "failed";
}

export interface CustomerUsage {
  upload_gb: number;
  download_gb: number;
  total_gb: number;
  limit_gb: number;
  period_start: string;
  period_end: string;
}

export interface CustomerTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  category: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerPaymentMethod {
  payment_method_id: string;
  method_type: "card" | "bank_account" | "wallet" | "wire_transfer" | "check";
  status: "active" | "pending_verification" | "verification_failed" | "expired" | "inactive";
  is_default: boolean;
  card_brand?: string;
  card_last4?: string;
  card_exp_month?: number;
  card_exp_year?: number;
  bank_name?: string;
  bank_account_last4?: string;
  bank_account_type?: string;
  wallet_type?: string;
  billing_name?: string;
  billing_email?: string;
  billing_address_line1?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postal_code?: string;
  is_verified?: boolean;
  created_at: string;
  auto_pay_enabled?: boolean;
}

// ============================================================================
// Query Keys Factory
// ============================================================================

export const customerPortalKeys = {
  all: ["customerPortal"] as const,
  profile: () => [...customerPortalKeys.all, "profile"] as const,
  service: () => [...customerPortalKeys.all, "service"] as const,
  invoices: () => [...customerPortalKeys.all, "invoices"] as const,
  payments: () => [...customerPortalKeys.all, "payments"] as const,
  paymentMethods: () => [...customerPortalKeys.all, "paymentMethods"] as const,
  usage: () => [...customerPortalKeys.all, "usage"] as const,
  tickets: () => [...customerPortalKeys.all, "tickets"] as const,
  settings: () => [...customerPortalKeys.all, "settings"] as const,
};

// ============================================================================
// API Functions
// ============================================================================

const customerPortalApi = {
  fetchProfile: async (): Promise<CustomerProfile> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/profile"));
    if (!response.ok) {
      throw new Error("Failed to fetch profile");
    }
    return response.json();
  },

  updateProfile: async (updates: Partial<CustomerProfile>): Promise<CustomerProfile> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/profile"), {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error("Failed to update profile");
    }
    return response.json();
  },

  fetchService: async (): Promise<CustomerService> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/service"));
    if (!response.ok) {
      throw new Error("Failed to fetch service");
    }
    return response.json();
  },

  upgradePlan: async (planId: string): Promise<CustomerService> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/service/upgrade"), {
      method: "POST",
      body: JSON.stringify({ plan_id: planId }),
    });
    if (!response.ok) {
      throw new Error("Failed to upgrade plan");
    }
    return response.json();
  },

  fetchInvoices: async (): Promise<CustomerInvoice[]> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/invoices"));
    if (!response.ok) {
      throw new Error("Failed to fetch invoices");
    }
    return response.json();
  },

  fetchPayments: async (): Promise<CustomerPayment[]> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/payments"));
    if (!response.ok) {
      throw new Error("Failed to fetch payments");
    }
    return response.json();
  },

  makePayment: async (
    invoiceId: string,
    amount: number,
    paymentMethodId: string,
  ): Promise<CustomerPayment> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/payments"), {
      method: "POST",
      body: JSON.stringify({
        invoice_id: invoiceId,
        amount,
        payment_method_id: paymentMethodId,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to process payment");
    }
    return response.json();
  },

  fetchUsage: async (): Promise<CustomerUsage> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/usage"));
    if (!response.ok) {
      throw new Error("Failed to fetch usage");
    }
    return response.json();
  },

  fetchTickets: async (): Promise<CustomerTicket[]> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/tickets"));
    if (!response.ok) {
      throw new Error("Failed to fetch tickets");
    }
    return response.json();
  },

  createTicket: async (ticketData: {
    subject: string;
    description: string;
    category: string;
    priority: string;
  }): Promise<CustomerTicket> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/tickets"), {
      method: "POST",
      body: JSON.stringify(ticketData),
    });
    if (!response.ok) {
      throw new Error("Failed to create ticket");
    }
    return response.json();
  },

  fetchSettings: async (): Promise<Record<string, unknown>> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/settings"));
    if (!response.ok) {
      throw new Error("Failed to fetch settings");
    }
    return response.json();
  },

  updateSettings: async (updates: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/settings"), {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error("Failed to update settings");
    }
    return response.json();
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/change-password"), {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to change password");
    }
  },

  fetchPaymentMethods: async (): Promise<CustomerPaymentMethod[]> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/payment-methods"));
    if (!response.ok) {
      throw new Error("Failed to fetch payment methods");
    }
    return response.json();
  },

  addPaymentMethod: async (request: Record<string, unknown>): Promise<CustomerPaymentMethod> => {
    const response = await customerAuthFetch(buildApiUrl("/customer/payment-methods"), {
      method: "POST",
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error("Failed to add payment method");
    }
    return response.json();
  },

  setDefaultPaymentMethod: async (paymentMethodId: string): Promise<CustomerPaymentMethod> => {
    const response = await customerAuthFetch(
      buildApiUrl(`/customer/payment-methods/${paymentMethodId}/default`),
      { method: "POST" },
    );
    if (!response.ok) {
      throw new Error("Failed to set default payment method");
    }
    return response.json();
  },

  removePaymentMethod: async (paymentMethodId: string): Promise<void> => {
    const response = await customerAuthFetch(
      buildApiUrl(`/customer/payment-methods/${paymentMethodId}`),
      { method: "DELETE" },
    );
    if (!response.ok) {
      throw new Error("Failed to remove payment method");
    }
  },

  toggleAutoPay: async (paymentMethodId: string): Promise<CustomerPaymentMethod> => {
    const response = await customerAuthFetch(
      buildApiUrl(`/customer/payment-methods/${paymentMethodId}/toggle-autopay`),
      { method: "POST" },
    );
    if (!response.ok) {
      throw new Error("Failed to toggle auto pay");
    }
    return response.json();
  },
};

// ============================================================================
// useCustomerProfile Hook
// ============================================================================

export function useCustomerProfile() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: customerPortalKeys.profile(),
    queryFn: customerPortalApi.fetchProfile,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const updateMutation = useMutation({
    mutationFn: customerPortalApi.updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(customerPortalKeys.profile(), data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.profile() });
    },
  });

  return {
    profile: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? toMessage(query.error, "An error occurred") : null,
    refetch: query.refetch as () => void,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

// ============================================================================
// useCustomerService Hook
// ============================================================================

export function useCustomerService() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: customerPortalKeys.service(),
    queryFn: customerPortalApi.fetchService,
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });

  const upgradeMutation = useMutation({
    mutationFn: customerPortalApi.upgradePlan,
    onSuccess: (data) => {
      queryClient.setQueryData(customerPortalKeys.service(), data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.service() });
    },
  });

  return {
    service: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? toMessage(query.error, "An error occurred") : null,
    refetch: query.refetch as () => void,
    upgradePlan: upgradeMutation.mutateAsync,
    isUpgrading: upgradeMutation.isPending,
  };
}

// ============================================================================
// useCustomerInvoices Hook
// ============================================================================

export function useCustomerInvoices() {
  const query = useQuery({
    queryKey: customerPortalKeys.invoices(),
    queryFn: customerPortalApi.fetchInvoices,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  return {
    invoices: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? toMessage(query.error, "An error occurred") : null,
    refetch: query.refetch as () => void,
  };
}

// ============================================================================
// useCustomerPayments Hook
// ============================================================================

export function useCustomerPayments() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: customerPortalKeys.payments(),
    queryFn: customerPortalApi.fetchPayments,
    staleTime: 1 * 60 * 1000,
    retry: 1,
  });

  const makePaymentMutation = useMutation({
    mutationFn: ({
      invoiceId,
      amount,
      paymentMethodId,
    }: {
      invoiceId: string;
      amount: number;
      paymentMethodId: string;
    }) => customerPortalApi.makePayment(invoiceId, amount, paymentMethodId),
    onSuccess: (data) => {
      queryClient.setQueryData<CustomerPayment[]>(customerPortalKeys.payments(), (old = []) => [
        data,
        ...old,
      ]);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.payments() });
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.invoices() });
    },
  });

  return {
    payments: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? toMessage(query.error, "An error occurred") : null,
    refetch: query.refetch as () => void,
    makePayment: makePaymentMutation.mutateAsync,
    isProcessingPayment: makePaymentMutation.isPending,
  };
}

// ============================================================================
// useCustomerUsage Hook
// ============================================================================

export function useCustomerUsage() {
  const query = useQuery({
    queryKey: customerPortalKeys.usage(),
    queryFn: customerPortalApi.fetchUsage,
    staleTime: 30 * 1000,
    retry: 1,
  });

  return {
    usage: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? toMessage(query.error, "An error occurred") : null,
    refetch: query.refetch as () => void,
  };
}

// ============================================================================
// useCustomerTickets Hook
// ============================================================================

export function useCustomerTickets() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: customerPortalKeys.tickets(),
    queryFn: customerPortalApi.fetchTickets,
    staleTime: 1 * 60 * 1000,
    retry: 1,
  });

  const createTicketMutation = useMutation({
    mutationFn: customerPortalApi.createTicket,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.tickets() });
    },
  });

  return {
    tickets: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? toMessage(query.error, "An error occurred") : null,
    refetch: query.refetch as () => void,
    createTicket: createTicketMutation.mutateAsync,
    isCreatingTicket: createTicketMutation.isPending,
  };
}

// ============================================================================
// useCustomerSettings Hook
// ============================================================================

export function useCustomerSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: customerPortalKeys.settings(),
    queryFn: customerPortalApi.fetchSettings,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: customerPortalApi.updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(customerPortalKeys.settings(), data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.settings() });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => customerPortalApi.changePassword(currentPassword, newPassword),
  });

  return {
    settings: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? toMessage(query.error, "An error occurred") : null,
    refetch: query.refetch as () => void,
    updateSettings: updateSettingsMutation.mutateAsync,
    changePassword: changePasswordMutation.mutateAsync,
    isUpdatingSettings: updateSettingsMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
  };
}

// ============================================================================
// useCustomerPaymentMethods Hook
// ============================================================================

export function useCustomerPaymentMethods() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: customerPortalKeys.paymentMethods(),
    queryFn: customerPortalApi.fetchPaymentMethods,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const addMutation = useMutation({
    mutationFn: customerPortalApi.addPaymentMethod,
    onSuccess: (newMethod) => {
      queryClient.setQueryData<CustomerPaymentMethod[]>(
        customerPortalKeys.paymentMethods(),
        (old = []) => [...old, newMethod],
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.paymentMethods() });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: customerPortalApi.setDefaultPaymentMethod,
    onSuccess: (updated, paymentMethodId) => {
      queryClient.setQueryData<CustomerPaymentMethod[]>(
        customerPortalKeys.paymentMethods(),
        (old = []) =>
          old.map((pm) => ({
            ...pm,
            is_default: pm.payment_method_id === paymentMethodId,
          })),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.paymentMethods() });
    },
  });

  const removeMutation = useMutation({
    mutationFn: customerPortalApi.removePaymentMethod,
    onSuccess: (_, paymentMethodId) => {
      queryClient.setQueryData<CustomerPaymentMethod[]>(
        customerPortalKeys.paymentMethods(),
        (old = []) => old.filter((pm) => pm.payment_method_id !== paymentMethodId),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.paymentMethods() });
    },
  });

  const toggleAutoPayMutation = useMutation({
    mutationFn: customerPortalApi.toggleAutoPay,
    onSuccess: (updated) => {
      queryClient.setQueryData<CustomerPaymentMethod[]>(
        customerPortalKeys.paymentMethods(),
        (old = []) =>
          old.map((pm) => ({
            ...pm,
            auto_pay_enabled:
              pm.payment_method_id === updated.payment_method_id
                ? (updated.auto_pay_enabled ?? false)
                : false,
          })),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.paymentMethods() });
    },
  });

  const paymentMethods = query.data ?? [];
  const defaultPaymentMethod = paymentMethods.find((pm) => pm.is_default);
  const autoPayPaymentMethod = paymentMethods.find((pm) => pm.auto_pay_enabled);

  return {
    paymentMethods,
    defaultPaymentMethod,
    autoPayPaymentMethod,
    loading: query.isLoading,
    error: query.error ? toMessage(query.error, "An error occurred") : null,
    refetch: query.refetch as () => void,
    addPaymentMethod: addMutation.mutateAsync,
    setDefaultPaymentMethod: setDefaultMutation.mutateAsync,
    removePaymentMethod: removeMutation.mutateAsync,
    toggleAutoPay: toggleAutoPayMutation.mutateAsync,
  };
}
