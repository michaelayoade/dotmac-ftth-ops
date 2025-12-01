"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPortalAuthFetch,
  CUSTOMER_PORTAL_TOKEN_KEY,
  PortalAuthError,
} from "../../../shared/utils/operatorAuth";
import type { PlatformConfig } from "@/lib/config";
import { logger } from "@/lib/logger";
import { useAppConfig } from "@/providers/AppConfigContext";
const customerPortalFetch = createPortalAuthFetch(CUSTOMER_PORTAL_TOKEN_KEY);
type BuildApiUrl = PlatformConfig["api"]["buildUrl"];

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

const toMessage = (error: unknown, fallback: string) =>
  error instanceof PortalAuthError
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

function createCustomerPortalApi(buildUrl: BuildApiUrl) {
  return {
    fetchProfile: async (): Promise<CustomerProfile> => {
      const response = await customerPortalFetch(buildUrl("/customer/profile"));
      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }
      return response.json();
    },

    updateProfile: async (updates: Partial<CustomerProfile>): Promise<CustomerProfile> => {
      const response = await customerPortalFetch(buildUrl("/customer/profile"), {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error("Failed to update profile");
      }
      return response.json();
    },

    fetchService: async (): Promise<CustomerService> => {
      const response = await customerPortalFetch(buildUrl("/customer/service"));
      if (!response.ok) {
        throw new Error("Failed to fetch service");
      }
      return response.json();
    },

    upgradePlan: async (planId: string): Promise<CustomerService> => {
      const response = await customerPortalFetch(buildUrl("/customer/service/upgrade"), {
        method: "POST",
        body: JSON.stringify({ plan_id: planId }),
      });
      if (!response.ok) {
        throw new Error("Failed to upgrade plan");
      }
      return response.json();
    },

    fetchInvoices: async (): Promise<CustomerInvoice[]> => {
      const response = await customerPortalFetch(buildUrl("/customer/invoices"));
      if (!response.ok) {
        throw new Error("Failed to fetch invoices");
      }
      return response.json();
    },

    fetchPayments: async (): Promise<CustomerPayment[]> => {
      const response = await customerPortalFetch(buildUrl("/customer/payments"));
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
      const response = await customerPortalFetch(buildUrl("/customer/payments"), {
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
      const response = await customerPortalFetch(buildUrl("/customer/usage"));
      if (!response.ok) {
        throw new Error("Failed to fetch usage");
      }
      return response.json();
    },

    fetchTickets: async (): Promise<CustomerTicket[]> => {
      const response = await customerPortalFetch(buildUrl("/customer/tickets"));
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
      const response = await customerPortalFetch(buildUrl("/customer/tickets"), {
        method: "POST",
        body: JSON.stringify(ticketData),
      });
      if (!response.ok) {
        throw new Error("Failed to create ticket");
      }
      return response.json();
    },

    fetchSettings: async (): Promise<any> => {
      const response = await customerPortalFetch(buildUrl("/customer/settings"));
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      return response.json();
    },

    updateSettings: async (updates: any): Promise<any> => {
      const response = await customerPortalFetch(buildUrl("/customer/settings"), {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error("Failed to update settings");
      }
      return response.json();
    },

    changePassword: async (currentPassword: string, newPassword: string): Promise<any> => {
      const response = await customerPortalFetch(buildUrl("/customer/change-password"), {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to change password");
      }
      return response.json();
    },

    fetchPaymentMethods: async (): Promise<CustomerPaymentMethod[]> => {
      const response = await customerPortalFetch(buildUrl("/customer/payment-methods"));
      if (!response.ok) {
        throw new Error("Failed to fetch payment methods");
      }
      return response.json();
    },

    addPaymentMethod: async (request: any): Promise<CustomerPaymentMethod> => {
      const response = await customerPortalFetch(buildUrl("/customer/payment-methods"), {
        method: "POST",
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        throw new Error("Failed to add payment method");
      }
      return response.json();
    },

    setDefaultPaymentMethod: async (paymentMethodId: string): Promise<CustomerPaymentMethod> => {
      const response = await customerPortalFetch(
        buildUrl(`/customer/payment-methods/${paymentMethodId}/default`),
        {
          method: "POST",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to set default payment method");
      }
      return response.json();
    },

    removePaymentMethod: async (paymentMethodId: string): Promise<void> => {
      const response = await customerPortalFetch(
        buildUrl(`/customer/payment-methods/${paymentMethodId}`),
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to remove payment method");
      }
    },

    toggleAutoPay: async (paymentMethodId: string): Promise<CustomerPaymentMethod> => {
      const response = await customerPortalFetch(
        buildUrl(`/customer/payment-methods/${paymentMethodId}/toggle-autopay`),
        {
          method: "POST",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to toggle auto pay");
      }
      return response.json();
    },
  };
}

function useCustomerPortalApiContext() {
  const { api } = useAppConfig();
  const portalApi = useMemo(() => createCustomerPortalApi(api.buildUrl), [api.buildUrl]);
  return {
    portalApi,
    apiBaseUrl: api.baseUrl,
    apiPrefix: api.prefix,
  };
}

// ============================================================================
// useCustomerProfile Hook
// ============================================================================

export function useCustomerProfile(): {
  profile: CustomerProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  updateProfile: (updates: Partial<CustomerProfile>) => Promise<CustomerProfile>;
  isUpdating: boolean;
} {
  const queryClient = useQueryClient();
  const { portalApi, apiBaseUrl, apiPrefix } = useCustomerPortalApiContext();
  const queryKey = useMemo(
    () => [...customerPortalKeys.profile(), apiBaseUrl, apiPrefix],
    [apiBaseUrl, apiPrefix],
  );

  const query = useQuery({
    queryKey,
    queryFn: portalApi.fetchProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes - profile data doesn't change often
    retry: 1,
  });

  const updateMutation = useMutation({
    mutationFn: portalApi.updateProfile,
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousProfile = queryClient.getQueryData<CustomerProfile>(queryKey);

      // Optimistically update
      if (previousProfile) {
        queryClient.setQueryData<CustomerProfile>(queryKey, {
          ...previousProfile,
          ...updates,
        });
      }

      logger.info("Updating customer profile optimistically", { updates });

      return { previousProfile };
    },
    onError: (error, variables, context) => {
      // Roll back on error
      if (context?.previousProfile) {
        queryClient.setQueryData(queryKey, context.previousProfile);
      }
      logger.error("Error updating customer profile", toError(error));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      logger.info("Customer profile updated successfully", { data });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
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

export function useCustomerService(): {
  service: CustomerService | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  upgradePlan: (planId: string) => Promise<CustomerService>;
  isUpgrading: boolean;
} {
  const queryClient = useQueryClient();
  const { portalApi, apiBaseUrl, apiPrefix } = useCustomerPortalApiContext();

  const query = useQuery({
    queryKey: [...customerPortalKeys.service(), apiBaseUrl, apiPrefix],
    queryFn: portalApi.fetchService,
    staleTime: 3 * 60 * 1000, // 3 minutes - service details may change with plan upgrades
    retry: 1,
  });

  const upgradeMutation = useMutation({
    mutationFn: portalApi.upgradePlan,
    onMutate: async (planId) => {
      await queryClient.cancelQueries({ queryKey: customerPortalKeys.service() });
      const previousService = queryClient.getQueryData<CustomerService>(
        customerPortalKeys.service(),
      );
      logger.info("Upgrading plan", { planId });
      return { previousService };
    },
    onError: (error, variables, context) => {
      if (context?.previousService) {
        queryClient.setQueryData(customerPortalKeys.service(), context.previousService);
      }
      logger.error("Error upgrading plan", toError(error));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(customerPortalKeys.service(), data);
      logger.info("Plan upgraded successfully", { data });
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

export function useCustomerInvoices(): {
  invoices: CustomerInvoice[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { portalApi, apiBaseUrl, apiPrefix } = useCustomerPortalApiContext();
  const query = useQuery({
    queryKey: [...customerPortalKeys.invoices(), apiBaseUrl, apiPrefix],
    queryFn: portalApi.fetchInvoices,
    staleTime: 2 * 60 * 1000, // 2 minutes - invoices may be updated with payments
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

export function useCustomerPayments(): {
  payments: CustomerPayment[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  makePayment: (args: {
    invoiceId: string;
    amount: number;
    paymentMethodId: string;
  }) => Promise<CustomerPayment>;
  isProcessingPayment: boolean;
} {
  const queryClient = useQueryClient();
  const { portalApi, apiBaseUrl, apiPrefix } = useCustomerPortalApiContext();
  const queryKey = useMemo(
    () => [...customerPortalKeys.payments(), apiBaseUrl, apiPrefix],
    [apiBaseUrl, apiPrefix],
  );
  const invoicesQueryKey = useMemo(
    () => [...customerPortalKeys.invoices(), apiBaseUrl, apiPrefix],
    [apiBaseUrl, apiPrefix],
  );

  const query = useQuery({
    queryKey,
    queryFn: portalApi.fetchPayments,
    staleTime: 1 * 60 * 1000, // 1 minute - payments may change frequently
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
    }) => portalApi.makePayment(invoiceId, amount, paymentMethodId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      logger.info("Making payment");
    },
    onError: (error) => {
      logger.error("Error making payment", toError(error));
    },
    onSuccess: (data) => {
      queryClient.setQueryData<CustomerPayment[]>(queryKey, (old = []) => [data, ...old]);
      logger.info("Payment processed successfully", { data });
    },
    onSettled: () => {
      // Invalidate both payments and invoices as they're related
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: invoicesQueryKey });
    },
  });

  return {
    payments: query.data ?? [],
    loading: query.isLoading || makePaymentMutation.isPending,
    error: query.error ? toMessage(query.error, "An error occurred") : null,
    refetch: query.refetch as () => void,
    makePayment: makePaymentMutation.mutateAsync,
    isProcessingPayment: makePaymentMutation.isPending,
  };
}

// ============================================================================
// useCustomerUsage Hook
// ============================================================================

export function useCustomerUsage(): {
  usage: CustomerUsage | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { portalApi, apiBaseUrl, apiPrefix } = useCustomerPortalApiContext();
  const query = useQuery({
    queryKey: [...customerPortalKeys.usage(), apiBaseUrl, apiPrefix],
    queryFn: portalApi.fetchUsage,
    staleTime: 30 * 1000, // 30 seconds - usage data changes frequently
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

export function useCustomerTickets(): {
  tickets: CustomerTicket[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createTicket: (ticketData: {
    subject: string;
    description: string;
    category: string;
    priority: string;
  }) => Promise<CustomerTicket>;
  isCreatingTicket: boolean;
} {
  const queryClient = useQueryClient();
  const { portalApi, apiBaseUrl, apiPrefix } = useCustomerPortalApiContext();

  const query = useQuery({
    queryKey: [...customerPortalKeys.tickets(), apiBaseUrl, apiPrefix],
    queryFn: portalApi.fetchTickets,
    staleTime: 1 * 60 * 1000, // 1 minute - tickets may be updated frequently
    retry: 1,
  });

  const createTicketMutation = useMutation({
    mutationFn: portalApi.createTicket,
    onMutate: async (ticketData) => {
      await queryClient.cancelQueries({ queryKey: customerPortalKeys.tickets() });
      logger.info("Creating ticket", { ticketData });
    },
    onError: (error) => {
      logger.error("Error creating ticket", toError(error));
    },
    onSuccess: (data) => {
      logger.info("Ticket created successfully", { data });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.tickets() });
    },
  });

  return {
    tickets: query.data ?? [],
    loading: query.isLoading || createTicketMutation.isPending,
    error: query.error ? toMessage(query.error, "An error occurred") : null,
    refetch: query.refetch as () => void,
    createTicket: createTicketMutation.mutateAsync,
    isCreatingTicket: createTicketMutation.isPending,
  };
}

// ============================================================================
// useCustomerSettings Hook
// ============================================================================

export function useCustomerSettings(): {
  settings: any;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  updateSettings: (updates: any) => Promise<any>;
  changePassword: (args: { currentPassword: string; newPassword: string }) => Promise<any>;
  isUpdatingSettings: boolean;
  isChangingPassword: boolean;
} {
  const queryClient = useQueryClient();
  const { portalApi, apiBaseUrl, apiPrefix } = useCustomerPortalApiContext();
  const queryKey = useMemo(
    () => [...customerPortalKeys.settings(), apiBaseUrl, apiPrefix],
    [apiBaseUrl, apiPrefix],
  );

  const query = useQuery({
    queryKey,
    queryFn: portalApi.fetchSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes - settings don't change often
    retry: 1,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: portalApi.updateSettings,
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey });
      const previousSettings = queryClient.getQueryData(queryKey);

      // Optimistically update
      if (previousSettings) {
        queryClient.setQueryData(queryKey, {
          ...previousSettings,
          ...updates,
        });
      }

      logger.info("Updating customer settings optimistically", { updates });
      return { previousSettings };
    },
    onError: (error, variables, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(queryKey, context.previousSettings);
      }
      logger.error("Error updating customer settings", toError(error));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      logger.info("Customer settings updated successfully", { data });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => portalApi.changePassword(currentPassword, newPassword),
    onMutate: () => {
      logger.info("Changing password");
    },
    onError: (error) => {
      logger.error("Error changing password", toError(error));
    },
    onSuccess: (data) => {
      logger.info("Password changed successfully", { data });
    },
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

export function useCustomerPaymentMethods(): {
  paymentMethods: CustomerPaymentMethod[];
  defaultPaymentMethod: CustomerPaymentMethod | undefined;
  autoPayPaymentMethod: CustomerPaymentMethod | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  addPaymentMethod: (request: any) => Promise<CustomerPaymentMethod>;
  setDefaultPaymentMethod: (paymentMethodId: string) => Promise<CustomerPaymentMethod>;
  removePaymentMethod: (paymentMethodId: string) => Promise<void>;
  toggleAutoPay: (paymentMethodId: string) => Promise<CustomerPaymentMethod>;
} {
  const queryClient = useQueryClient();
  const { portalApi, apiBaseUrl, apiPrefix } = useCustomerPortalApiContext();
  const queryKey = useMemo(
    () => [...customerPortalKeys.paymentMethods(), apiBaseUrl, apiPrefix],
    [apiBaseUrl, apiPrefix],
  );

  const query = useQuery({
    queryKey,
    queryFn: portalApi.fetchPaymentMethods,
    staleTime: 2 * 60 * 1000, // 2 minutes - payment methods don't change often
    retry: 1,
  });

  const addMutation = useMutation({
    mutationFn: (request: any) => portalApi.addPaymentMethod(request),
    onSuccess: (newMethod) => {
      queryClient.setQueryData<CustomerPaymentMethod[]>(queryKey, (old = []) => [
        ...old,
        newMethod,
      ]);
      queryClient.invalidateQueries({ queryKey });
      logger.info("Payment method added successfully");
    },
    onError: (error) => {
      logger.error("Error adding payment method", toError(error));
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (paymentMethodId: string) => portalApi.setDefaultPaymentMethod(paymentMethodId),
    onSuccess: (updated, paymentMethodId) => {
      queryClient.setQueryData<CustomerPaymentMethod[]>(queryKey, (old = []) =>
        old.map((pm) => ({
          ...pm,
          is_default: pm.payment_method_id === paymentMethodId,
          auto_pay_enabled: pm.payment_method_id === paymentMethodId ? updated.auto_pay_enabled : pm.auto_pay_enabled,
        })),
      );
      queryClient.invalidateQueries({ queryKey });
      logger.info("Default payment method updated");
    },
    onError: (error) => {
      logger.error("Error setting default payment method", toError(error));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (paymentMethodId: string) => portalApi.removePaymentMethod(paymentMethodId),
    onSuccess: (_, paymentMethodId) => {
      queryClient.setQueryData<CustomerPaymentMethod[]>(queryKey, (old = []) =>
        old.filter((pm) => pm.payment_method_id !== paymentMethodId),
      );
      queryClient.invalidateQueries({ queryKey });
      logger.info("Payment method removed successfully");
    },
    onError: (error) => {
      logger.error("Error removing payment method", toError(error));
    },
  });

  const toggleAutoPayMutation = useMutation({
    mutationFn: (paymentMethodId: string) => portalApi.toggleAutoPay(paymentMethodId),
    onSuccess: (updated) => {
      queryClient.setQueryData<CustomerPaymentMethod[]>(queryKey, (old = []) =>
        old.map((pm) => ({
          ...pm,
          auto_pay_enabled: pm.payment_method_id === updated.payment_method_id ? updated.auto_pay_enabled : false,
          is_default: pm.payment_method_id === updated.payment_method_id ? updated.is_default : pm.is_default,
        })),
      );
      queryClient.invalidateQueries({ queryKey });
      logger.info("Auto pay toggled successfully");
    },
    onError: (error) => {
      logger.error("Error toggling auto pay", toError(error));
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
    toggleAutoPay: (paymentMethodId: string) => toggleAutoPayMutation.mutateAsync(paymentMethodId),
  };
}
