"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantAppConfig } from "@/lib/config";
import { getTenantToken } from "@/lib/auth/token-utils";

// Types
export interface TenantStats {
  active_users: number;
  total_users: number;
  storage_used: number;
  total_api_calls: number;
  plan: string;
}

export interface TenantSubscription {
  subscription_id: string;
  tenant_id: string;
  plan_id: string;
  plan_name: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "unpaid";
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
  cancel_at_period_end: boolean;
  billing_cycle: "monthly" | "quarterly" | "annual";
  price_amount: number;
  currency: string;
  usage?: {
    users: { current: number; limit?: number };
    storage: { current: number; limit?: number };
    api_calls: { current: number; limit?: number };
  };
  created_at: string;
  updated_at: string;
}

export interface AvailablePlan {
  plan_id: string;
  name: string;
  display_name: string;
  description: string;
  billing_cycle: "monthly" | "quarterly" | "annual";
  price_amount: number;
  currency: string;
  trial_days: number;
  features: Record<string, unknown>;
  is_featured: boolean;
}

export interface TenantPaymentMethod {
  id: string;
  type: "card" | "bank_account" | "invoice";
  brand?: string;
  last_four?: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
  created_at: string;
}

export interface TenantInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  due_date: string;
  paid_at?: string;
  period_start: string;
  period_end: string;
  download_url?: string;
  created_at: string;
}

export interface TenantAddon {
  id: string;
  name: string;
  description: string;
  price_amount: number;
  currency: string;
  billing_cycle: string;
  is_active: boolean;
  activated_at?: string;
}

export interface TenantUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: "active" | "pending" | "disabled";
  last_login?: string;
  created_at: string;
}

export interface UsageMetrics {
  period_start: string;
  period_end: string;
  api_calls: { current: number; limit: number; percentage: number };
  storage: { current: number; limit: number; percentage: number };
  users: { current: number; limit: number; percentage: number };
  bandwidth?: { current: number; limit: number; percentage: number };
}

function getAuthHeaders(): HeadersInit {
  const token = getTenantToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// API Functions
async function fetchTenantStats(): Promise<TenantStats> {
  const response = await fetch(
    tenantAppConfig.api.buildUrl("/tenants/current/stats"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch tenant stats");
  return response.json();
}

async function fetchSubscription(): Promise<TenantSubscription> {
  const response = await fetch(
    tenantAppConfig.api.buildUrl("/billing/tenant/subscription/current"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch subscription");
  return response.json();
}

async function fetchAvailablePlans(): Promise<AvailablePlan[]> {
  const response = await fetch(
    tenantAppConfig.api.buildUrl("/billing/tenant/subscription/available-plans"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch available plans");
  return response.json();
}

async function fetchPaymentMethods(): Promise<TenantPaymentMethod[]> {
  const response = await fetch(
    tenantAppConfig.api.buildUrl("/billing/tenant/payment-methods"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch payment methods");
  return response.json();
}

async function fetchInvoices(): Promise<TenantInvoice[]> {
  const response = await fetch(
    tenantAppConfig.api.buildUrl("/billing/tenant/invoices"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch invoices");
  return response.json();
}

async function fetchAddons(): Promise<TenantAddon[]> {
  const response = await fetch(
    tenantAppConfig.api.buildUrl("/billing/tenant/addons"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch addons");
  return response.json();
}

async function fetchTenantUsers(): Promise<TenantUser[]> {
  const response = await fetch(
    tenantAppConfig.api.buildUrl("/tenants/current/users"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch users");
  return response.json();
}

async function fetchUsageMetrics(): Promise<UsageMetrics> {
  const response = await fetch(
    tenantAppConfig.api.buildUrl("/usage/current"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch usage metrics");
  return response.json();
}

// Hooks
export function useTenantStats() {
  return useQuery({
    queryKey: ["tenant-stats"],
    queryFn: fetchTenantStats,
    staleTime: 60000,
  });
}

export function useTenantSubscription() {
  return useQuery({
    queryKey: ["tenant-subscription"],
    queryFn: fetchSubscription,
    staleTime: 60000,
  });
}

export function useAvailablePlans() {
  return useQuery({
    queryKey: ["available-plans"],
    queryFn: fetchAvailablePlans,
    staleTime: 300000,
  });
}

export function useTenantPaymentMethods() {
  return useQuery({
    queryKey: ["tenant-payment-methods"],
    queryFn: fetchPaymentMethods,
  });
}

export function useTenantInvoices() {
  return useQuery({
    queryKey: ["tenant-invoices"],
    queryFn: fetchInvoices,
  });
}

export function useTenantAddons() {
  return useQuery({
    queryKey: ["tenant-addons"],
    queryFn: fetchAddons,
  });
}

export function useTenantUsers() {
  return useQuery({
    queryKey: ["tenant-users"],
    queryFn: fetchTenantUsers,
  });
}

export function useUsageMetrics() {
  return useQuery({
    queryKey: ["usage-metrics"],
    queryFn: fetchUsageMetrics,
    staleTime: 30000,
  });
}

// Mutations
export function useChangePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetch(
        tenantAppConfig.api.buildUrl("/billing/tenant/subscription/change-plan"),
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ new_plan_id: planId }),
        }
      );
      if (!response.ok) throw new Error("Failed to change plan");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-subscription"] });
    },
  });
}

export function useAddPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { type: string; token: string }) => {
      const response = await fetch(
        tenantAppConfig.api.buildUrl("/billing/tenant/payment-methods"),
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw new Error("Failed to add payment method");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-payment-methods"] });
    },
  });
}

export function useActivateAddon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (addonId: string) => {
      const response = await fetch(
        tenantAppConfig.api.buildUrl(`/billing/tenant/addons/${addonId}/activate`),
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error("Failed to activate addon");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-addons"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-subscription"] });
    },
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const response = await fetch(
        tenantAppConfig.api.buildUrl("/tenants/current/users/invite"),
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw new Error("Failed to invite user");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-users"] });
    },
  });
}
