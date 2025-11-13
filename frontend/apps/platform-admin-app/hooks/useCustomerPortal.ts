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

// ============================================================================
// Query Keys Factory
// ============================================================================

export const customerPortalKeys = {
  all: ["customerPortal"] as const,
  profile: () => [...customerPortalKeys.all, "profile"] as const,
  service: () => [...customerPortalKeys.all, "service"] as const,
  invoices: () => [...customerPortalKeys.all, "invoices"] as const,
  payments: () => [...customerPortalKeys.all, "payments"] as const,
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
    const response = await customerPortalFetch(
      buildUrl("/customer/service/upgrade"),
      {
        method: "POST",
        body: JSON.stringify({ plan_id: planId }),
      },
    );
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
    const response = await customerPortalFetch(
      buildUrl("/customer/change-password"),
      {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to change password");
    }
    return response.json();
  },
  };
}

function useCustomerPortalApiContext() {
  const { api } = useAppConfig();
  const portalApi = useMemo(() => createCustomerPortalApi(api.buildUrl), [api.baseUrl, api.prefix]);
  return {
    portalApi,
    apiBaseUrl: api.baseUrl,
    apiPrefix: api.prefix,
  };
}

// ============================================================================
// useCustomerProfile Hook
// ============================================================================

export function useCustomerProfile() {
  const queryClient = useQueryClient();
  const { portalApi, apiBaseUrl, apiPrefix } = useCustomerPortalApiContext();

  const query = useQuery({
    queryKey: [...customerPortalKeys.profile(), apiBaseUrl, apiPrefix],
    queryFn: portalApi.fetchProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes - profile data doesn't change often
    retry: 1,
  });

  const updateMutation = useMutation({
    mutationFn: portalApi.updateProfile,
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: customerPortalKeys.profile() });

      // Snapshot previous value
      const previousProfile = queryClient.getQueryData<CustomerProfile>(
        customerPortalKeys.profile(),
      );

      // Optimistically update
      if (previousProfile) {
        queryClient.setQueryData<CustomerProfile>(customerPortalKeys.profile(), {
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
        queryClient.setQueryData(customerPortalKeys.profile(), context.previousProfile);
      }
      logger.error("Error updating customer profile", toError(error));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(customerPortalKeys.profile(), data);
      logger.info("Customer profile updated successfully", { data });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.profile() });
    },
  });

  return {
    profile: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? toMessage(query.error, "An error occurred") : null,
    refetch: query.refetch,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

// ============================================================================
// useCustomerService Hook
// ============================================================================

export function useCustomerService() {
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
    refetch: query.refetch,
    upgradePlan: upgradeMutation.mutateAsync,
    isUpgrading: upgradeMutation.isPending,
  };
}

// ============================================================================
// useCustomerInvoices Hook
// ============================================================================

export function useCustomerInvoices() {
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
    refetch: query.refetch,
  };
}

// ============================================================================
// useCustomerPayments Hook
// ============================================================================

export function useCustomerPayments() {
  const queryClient = useQueryClient();
  const { portalApi, apiBaseUrl, apiPrefix } = useCustomerPortalApiContext();

  const query = useQuery({
    queryKey: [...customerPortalKeys.payments(), apiBaseUrl, apiPrefix],
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
      await queryClient.cancelQueries({ queryKey: customerPortalKeys.payments() });
      logger.info("Making payment");
    },
    onError: (error) => {
      logger.error("Error making payment", toError(error));
    },
    onSuccess: (data) => {
      logger.info("Payment processed successfully", { data });
    },
    onSettled: () => {
      // Invalidate both payments and invoices as they're related
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.payments() });
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.invoices() });
    },
  });

  return {
    payments: query.data ?? [],
    loading: query.isLoading || makePaymentMutation.isPending,
    error: query.error ? toMessage(query.error, "An error occurred") : null,
    refetch: query.refetch,
    makePayment: makePaymentMutation.mutateAsync,
    isProcessingPayment: makePaymentMutation.isPending,
  };
}

// ============================================================================
// useCustomerUsage Hook
// ============================================================================

export function useCustomerUsage() {
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
    refetch: query.refetch,
  };
}

// ============================================================================
// useCustomerTickets Hook
// ============================================================================

export function useCustomerTickets() {
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
    refetch: query.refetch,
    createTicket: createTicketMutation.mutateAsync,
    isCreatingTicket: createTicketMutation.isPending,
  };
}

// ============================================================================
// useCustomerSettings Hook
// ============================================================================

export function useCustomerSettings() {
  const queryClient = useQueryClient();
  const { portalApi, apiBaseUrl, apiPrefix } = useCustomerPortalApiContext();

  const query = useQuery({
    queryKey: [...customerPortalKeys.settings(), apiBaseUrl, apiPrefix],
    queryFn: portalApi.fetchSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes - settings don't change often
    retry: 1,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: portalApi.updateSettings,
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: customerPortalKeys.settings() });
      const previousSettings = queryClient.getQueryData(customerPortalKeys.settings());

      // Optimistically update
      if (previousSettings) {
        queryClient.setQueryData(customerPortalKeys.settings(), {
          ...previousSettings,
          ...updates,
        });
      }

      logger.info("Updating customer settings optimistically", { updates });
      return { previousSettings };
    },
    onError: (error, variables, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(customerPortalKeys.settings(), context.previousSettings);
      }
      logger.error("Error updating customer settings", toError(error));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(customerPortalKeys.settings(), data);
      logger.info("Customer settings updated successfully", { data });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerPortalKeys.settings() });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      portalApi.changePassword(currentPassword, newPassword),
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
    refetch: query.refetch,
    updateSettings: updateSettingsMutation.mutateAsync,
    changePassword: changePasswordMutation.mutateAsync,
    isUpdatingSettings: updateSettingsMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
  };
}
