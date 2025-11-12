"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformConfig } from "@/lib/config";

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

// Fetch headers helper
const getAuthHeaders = () => {
  if (typeof window === "undefined") return {};
  // Import dynamically to avoid issues with SSR
  const { getOperatorAccessToken } = require("../../../shared/utils/operatorAuth");
  const token = getOperatorAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// API Functions
async function fetchCommissionRules(params?: {
  partner_id?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}): Promise<CommissionRuleListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.partner_id) queryParams.append("partner_id", params.partner_id);
  if (params?.is_active !== undefined)
    queryParams.append("is_active", String(params.is_active));
  if (params?.page) queryParams.append("page", String(params.page));
  if (params?.page_size) queryParams.append("page_size", String(params.page_size));

  const url = platformConfig.api.buildUrl(`/partners/commission-rules/?${queryParams}`);
  const res = await fetch(url, { headers: getAuthHeaders(), credentials: "include" });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to fetch commission rules" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

async function fetchCommissionRule(ruleId: string): Promise<CommissionRule> {
  const url = platformConfig.api.buildUrl(`/partners/commission-rules/${ruleId}`);
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to fetch commission rule" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

async function createCommissionRule(
  data: CreateCommissionRuleInput
): Promise<CommissionRule> {
  const url = platformConfig.api.buildUrl("/partners/commission-rules/");
  const res = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
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
  ruleId: string,
  data: UpdateCommissionRuleInput
): Promise<CommissionRule> {
  const url = platformConfig.api.buildUrl(`/partners/commission-rules/${ruleId}`);
  const res = await fetch(url, {
    method: "PATCH",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to update commission rule" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

async function deleteCommissionRule(ruleId: string): Promise<void> {
  const url = platformConfig.api.buildUrl(`/partners/commission-rules/${ruleId}`);
  const res = await fetch(url, {
    method: "DELETE",
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to delete commission rule" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
}

async function fetchApplicableRules(params: {
  partner_id: string;
  product_id?: string;
  customer_id?: string;
}): Promise<CommissionRule[]> {
  const queryParams = new URLSearchParams();
  if (params.product_id) queryParams.append("product_id", params.product_id);
  if (params.customer_id) queryParams.append("customer_id", params.customer_id);

  const url = platformConfig.api.buildUrl(`/partners/commission-rules/partners/${params.partner_id}/applicable?${queryParams}`);
  const res = await fetch(url, { headers: getAuthHeaders(), credentials: "include" });

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Failed to fetch applicable rules" }));
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
  return useQuery({
    queryKey: ["commission-rules", params],
    queryFn: () => fetchCommissionRules(params),
  });
}

export function useCommissionRule(ruleId: string | undefined) {
  return useQuery({
    queryKey: ["commission-rules", ruleId],
    queryFn: () => fetchCommissionRule(ruleId!),
    enabled: !!ruleId,
  });
}

export function useApplicableRules(params: {
  partner_id: string;
  product_id?: string;
  customer_id?: string;
}) {
  return useQuery({
    queryKey: ["commission-rules", "applicable", params],
    queryFn: () => fetchApplicableRules(params),
    enabled: !!params.partner_id,
  });
}

export function useCreateCommissionRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCommissionRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rules"] });
    },
  });
}

export function useUpdateCommissionRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId, data }: { ruleId: string; data: UpdateCommissionRuleInput }) =>
      updateCommissionRule(ruleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rules"] });
    },
  });
}

export function useDeleteCommissionRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCommissionRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rules"] });
    },
  });
}
