"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlatformConfig } from "@/lib/config";
import { useAppConfig } from "@/providers/AppConfigContext";

// Types
export type CommissionModel = "revenue_share" | "flat_fee" | "tiered" | "hybrid";

export interface CommissionRule {
  id: string;
  partner_id: string;
  tenant_id: string;
  rule_name: string;
  description?: string;
  commission_type: CommissionModel;
  commission_rate?: number;
  flat_fee_amount?: number;
  tier_config?: Record<string, any>;
  applies_to_products?: string[];
  applies_to_customers?: string[];
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface CommissionRuleListResponse {
  rules: CommissionRule[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateCommissionRuleInput {
  partner_id: string;
  rule_name: string;
  description?: string;
  commission_type: CommissionModel;
  commission_rate?: number;
  flat_fee_amount?: number;
  tier_config?: Record<string, any>;
  applies_to_products?: string[];
  applies_to_customers?: string[];
  effective_from: string;
  effective_to?: string;
  is_active?: boolean;
  priority?: number;
}

export interface UpdateCommissionRuleInput {
  rule_name?: string;
  description?: string;
  commission_type?: CommissionModel;
  commission_rate?: number;
  flat_fee_amount?: number;
  tier_config?: Record<string, any>;
  applies_to_products?: string[];
  applies_to_customers?: string[];
  effective_from?: string;
  effective_to?: string;
  is_active?: boolean;
  priority?: number;
}

type BuildApiUrl = PlatformConfig["api"]["buildUrl"];

const defaultHeaders = { "Content-Type": "application/json" };

// API Functions
async function fetchCommissionRules(
  buildUrl: BuildApiUrl,
  params?: {
    partner_id?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
  },
): Promise<CommissionRuleListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.partner_id) queryParams.append("partner_id", params.partner_id);
  if (params?.is_active !== undefined) queryParams.append("is_active", String(params.is_active));
  if (params?.page) queryParams.append("page", String(params.page));
  if (params?.page_size) queryParams.append("page_size", String(params.page_size));

  const url = buildUrl(`/partners/commission-rules/?${queryParams}`);
  const res = await fetch(url, { headers: defaultHeaders, credentials: "include" });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to fetch commission rules" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

async function fetchCommissionRule(buildUrl: BuildApiUrl, ruleId: string): Promise<CommissionRule> {
  const url = buildUrl(`/partners/commission-rules/${ruleId}`);
  const res = await fetch(url, {
    headers: defaultHeaders,
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to fetch commission rule" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

async function createCommissionRule(
  buildUrl: BuildApiUrl,
  data: CreateCommissionRuleInput,
): Promise<CommissionRule> {
  const url = buildUrl("/partners/commission-rules/");
  const res = await fetch(url, {
    method: "POST",
    headers: defaultHeaders,
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to create commission rule" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

async function updateCommissionRule(
  buildUrl: BuildApiUrl,
  ruleId: string,
  data: UpdateCommissionRuleInput,
): Promise<CommissionRule> {
  const url = buildUrl(`/partners/commission-rules/${ruleId}`);
  const res = await fetch(url, {
    method: "PATCH",
    headers: defaultHeaders,
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to update commission rule" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

async function deleteCommissionRule(buildUrl: BuildApiUrl, ruleId: string): Promise<void> {
  const url = buildUrl(`/partners/commission-rules/${ruleId}`);
  const res = await fetch(url, {
    method: "DELETE",
    headers: defaultHeaders,
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to delete commission rule" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
}

async function fetchApplicableRules(
  buildUrl: BuildApiUrl,
  params: {
    partner_id: string;
    product_id?: string;
    customer_id?: string;
  },
): Promise<CommissionRule[]> {
  const queryParams = new URLSearchParams();
  if (params.product_id) queryParams.append("product_id", params.product_id);
  if (params.customer_id) queryParams.append("customer_id", params.customer_id);

  const url = buildUrl(
    `/partners/commission-rules/partners/${params.partner_id}/applicable?${queryParams}`,
  );
  const res = await fetch(url, { headers: defaultHeaders, credentials: "include" });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to fetch applicable rules" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// React Query Hooks
export function useCommissionRules(params?: {
  partner_id?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}) {
  const { api } = useAppConfig();
  return useQuery({
    queryKey: ["commission-rules", params, api.baseUrl, api.prefix],
    queryFn: () => fetchCommissionRules(api.buildUrl, params),
  });
}

export function useCommissionRule(ruleId: string | undefined) {
  const { api } = useAppConfig();
  return useQuery({
    queryKey: ["commission-rules", ruleId, api.baseUrl, api.prefix],
    queryFn: () => fetchCommissionRule(api.buildUrl, ruleId!),
    enabled: !!ruleId,
  });
}

export function useApplicableRules(params: {
  partner_id: string;
  product_id?: string;
  customer_id?: string;
}) {
  const { api } = useAppConfig();
  return useQuery({
    queryKey: ["commission-rules", "applicable", params, api.baseUrl, api.prefix],
    queryFn: () => fetchApplicableRules(api.buildUrl, params),
    enabled: !!params.partner_id,
  });
}

export function useCreateCommissionRule() {
  const { api } = useAppConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCommissionRuleInput) => createCommissionRule(api.buildUrl, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rules"] });
    },
  });
}

export function useUpdateCommissionRule() {
  const { api } = useAppConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId, data }: { ruleId: string; data: UpdateCommissionRuleInput }) =>
      updateCommissionRule(api.buildUrl, ruleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rules"] });
    },
  });
}

export function useDeleteCommissionRule() {
  const { api } = useAppConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ruleId: string) => deleteCommissionRule(api.buildUrl, ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rules"] });
    },
  });
}
