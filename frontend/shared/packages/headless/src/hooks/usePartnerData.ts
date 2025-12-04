/**
 * React Query hooks for Partner Portal data
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPartnerApiClient } from "../api/partner-client";
import type {
  Customer,
  PartnerDashboardData,
  CreateCustomer,
  UpdateCustomer,
} from "../api/partner-client";
import type { ApiResponse } from "../api/types/api";

// Query Keys
export const partnerQueryKeys = {
  all: ["partner"] as const,
  dashboard: (partnerId: string) => [...partnerQueryKeys.all, "dashboard", partnerId] as const,
  customers: (partnerId: string) => [...partnerQueryKeys.all, "customers", partnerId] as const,
  customer: (partnerId: string, customerId: string) =>
    [...partnerQueryKeys.customers(partnerId), customerId] as const,
  commissions: (partnerId: string) => [...partnerQueryKeys.all, "commissions", partnerId] as const,
  analytics: (partnerId: string) => [...partnerQueryKeys.all, "analytics", partnerId] as const,
};

const getClient = () => getPartnerApiClient();

// Dashboard Hook
export function usePartnerDashboard(partnerId: string | undefined) {
  const client = getClient();
  return useQuery<ApiResponse<PartnerDashboardData>, Error, PartnerDashboardData>({
    queryKey: partnerQueryKeys.dashboard(partnerId || ""),
    queryFn: () => client.getDashboard(partnerId!),
    enabled: !!partnerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (response) => response.data,
  });
}

// Customers Hooks
export function usePartnerCustomers(
  partnerId: string | undefined,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  },
) {
  const client = getClient();
  return useQuery<
    ApiResponse<{ customers: Customer[]; total: number; pagination: any }>,
    Error,
    { customers: Customer[]; total: number; pagination: any }
  >({
    queryKey: [...partnerQueryKeys.customers(partnerId || ""), params],
    queryFn: () => client.getCustomers(partnerId!, params),
    enabled: !!partnerId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    select: (response) => response.data,
  });
}

export function usePartnerCustomer(partnerId: string | undefined, customerId: string | undefined) {
  const client = getClient();
  return useQuery<ApiResponse<Customer>, Error, Customer>({
    queryKey: partnerQueryKeys.customer(partnerId || "", customerId || ""),
    queryFn: () => client.getCustomer(partnerId!, customerId!),
    enabled: !!partnerId && !!customerId,
    select: (response) => response.data,
  });
}

// Customer Mutations
export function useCreateCustomer(partnerId: string) {
  const queryClient = useQueryClient();
  const client = getClient();

  return useMutation({
    mutationFn: (customerData: CreateCustomer) => client.createCustomer(partnerId, customerData),
    onSuccess: () => {
      // Invalidate and refetch customer list
      queryClient.invalidateQueries({
        queryKey: partnerQueryKeys.customers(partnerId),
      });
      // Invalidate dashboard to update metrics
      queryClient.invalidateQueries({
        queryKey: partnerQueryKeys.dashboard(partnerId),
      });
    },
  });
}

export function useUpdateCustomer(partnerId: string, customerId: string) {
  const queryClient = useQueryClient();
  const client = getClient();

  return useMutation({
    mutationFn: (customerData: UpdateCustomer) =>
      client.updateCustomer(partnerId, customerId, customerData),
    onSuccess: () => {
      // Invalidate specific customer
      queryClient.invalidateQueries({
        queryKey: partnerQueryKeys.customer(partnerId, customerId),
      });
      // Invalidate customer list
      queryClient.invalidateQueries({
        queryKey: partnerQueryKeys.customers(partnerId),
      });
      // Invalidate dashboard to update metrics
      queryClient.invalidateQueries({
        queryKey: partnerQueryKeys.dashboard(partnerId),
      });
    },
  });
}

// Commissions Hook
export function usePartnerCommissions(
  partnerId: string | undefined,
  params?: {
    page?: number;
    limit?: number;
    period?: string;
    status?: string;
  },
) {
  const client = getClient();
  return useQuery<ApiResponse<any>, Error, any>({
    queryKey: [...partnerQueryKeys.commissions(partnerId || ""), params],
    queryFn: () => client.getCommissions(partnerId!, params),
    enabled: !!partnerId,
    staleTime: 10 * 60 * 1000, // 10 minutes (financial data changes less frequently)
    select: (response) => response.data,
  });
}

// Analytics Hook
export function usePartnerAnalytics(
  partnerId: string | undefined,
  params?: {
    period?: string;
    metrics?: string[];
  },
) {
  const client = getClient();
  return useQuery<ApiResponse<any>, Error, any>({
    queryKey: [...partnerQueryKeys.analytics(partnerId || ""), params],
    queryFn: () => client.getAnalytics(partnerId!, params),
    enabled: !!partnerId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    select: (response) => response.data,
  });
}

// Territory Validation Hook
export function useValidateTerritory(partnerId: string) {
  const client = getClient();
  return useMutation({
    mutationFn: async (address: string) => {
      const response = await client.validateTerritory(partnerId, address);
      return response.data;
    },
  });
}

// Error boundary wrapper for partner data hooks
export function usePartnerDataWithErrorBoundary<T>(hookResult: {
  data: T;
  error: any;
  isLoading: boolean;
  isError: boolean;
}) {
  if (hookResult.isError && hookResult.error) {
    // Log security-relevant errors
    if (hookResult.error.status === 403 || hookResult.error.status === 401) {
      console.error("Partner access denied:", hookResult.error);
      // Could trigger logout or redirect to unauthorized page
    }

    if (hookResult.error.status >= 500) {
      console.error("Server error in partner data:", hookResult.error);
    }
  }

  return hookResult;
}
