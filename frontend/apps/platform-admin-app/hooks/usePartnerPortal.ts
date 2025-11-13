"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlatformConfig } from "@/lib/config";
import { useAppConfig } from "@/providers/AppConfigContext";

// Types
export interface PartnerDashboardStats {
  total_customers: number;
  active_customers: number;
  total_revenue_generated: number;
  total_commissions_earned: number;
  total_commissions_paid: number;
  pending_commissions: number;
  total_referrals: number;
  converted_referrals: number;
  pending_referrals: number;
  conversion_rate: number;
  current_tier: string;
  commission_model: string;
  default_commission_rate: number;
}

export interface PartnerProfile {
  id: string;
  partner_number: string;
  company_name: string;
  legal_name?: string;
  website?: string;
  status: string;
  tier: string;
  commission_model: string;
  default_commission_rate?: number;
  primary_email: string;
  billing_email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerReferral {
  id: string;
  partner_id: string;
  lead_name: string;
  lead_email: string;
  lead_phone?: string;
  company_name?: string;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  estimated_value?: number;
  actual_value?: number;
  converted_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerCommission {
  id: string;
  partner_id: string;
  customer_id: string;
  invoice_id?: string;
  amount: number;
  commission_rate: number;
  commission_amount: number;
  status: "pending" | "approved" | "paid" | "disputed" | "cancelled";
  event_date: string;
  payment_date?: string;
  notes?: string;
  created_at: string;
}

export interface PartnerCustomer {
  id: string;
  customer_id: string;
  customer_name: string;
  engagement_type: "direct" | "referral" | "reseller" | "affiliate";
  custom_commission_rate?: number;
  total_revenue: number;
  total_commissions: number;
  start_date: string;
  end_date?: string;
  is_active: boolean;
}

export type PartnerPayoutStatus =
  | "pending"
  | "ready"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface PartnerStatement {
  id: string;
  payout_id: string | null;
  period_start: string;
  period_end: string;
  issued_at: string;
  revenue_total: number;
  commission_total: number;
  adjustments_total: number;
  status: PartnerPayoutStatus;
  download_url?: string | null;
}

export interface PartnerPayoutRecord {
  id: string;
  partner_id: string;
  total_amount: number;
  currency: string;
  commission_count: number;
  payment_reference?: string | null;
  payment_method: string;
  status: PartnerPayoutStatus;
  payout_date: string;
  completed_at?: string | null;
  period_start: string;
  period_end: string;
  notes?: string | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
}

type BuildApiUrl = PlatformConfig["api"]["buildUrl"];

function normaliseDecimal(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return 0;
}

// API Functions
async function fetchPartnerDashboard(buildUrl: BuildApiUrl): Promise<PartnerDashboardStats> {
  const response = await fetch(buildUrl("/partners/portal/dashboard"), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard data");
  }

  return response.json();
}

async function fetchPartnerProfile(buildUrl: BuildApiUrl): Promise<PartnerProfile> {
  const response = await fetch(buildUrl("/partners/portal/profile"), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch profile");
  }

  return response.json();
}

async function updatePartnerProfile(
  buildUrl: BuildApiUrl,
  data: Partial<PartnerProfile>,
): Promise<PartnerProfile> {
  const response = await fetch(buildUrl("/partners/portal/profile"), {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to update profile");
  }

  return response.json();
}

async function fetchPartnerReferrals(
  buildUrl: BuildApiUrl,
  limit?: number,
  offset?: number,
): Promise<PartnerReferral[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.append("limit", limit.toString());
  if (offset !== undefined) params.append("offset", offset.toString());

  const url = buildUrl(
    `/partners/portal/referrals${params.toString() ? `?${params.toString()}` : ""}`,
  );
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch referrals");
  }

  return response.json();
}

async function submitReferral(
  buildUrl: BuildApiUrl,
  data: {
    lead_name: string;
    lead_email: string;
    lead_phone?: string;
    company_name?: string;
    estimated_value?: number;
    notes?: string;
  },
): Promise<PartnerReferral> {
  const response = await fetch(buildUrl("/partners/portal/referrals"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to submit referral");
  }

  return response.json();
}

async function fetchPartnerCommissions(
  buildUrl: BuildApiUrl,
  limit?: number,
  offset?: number,
): Promise<PartnerCommission[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.append("limit", limit.toString());
  if (offset !== undefined) params.append("offset", offset.toString());

  const url = buildUrl(
    `/partners/portal/commissions${params.toString() ? `?${params.toString()}` : ""}`,
  );
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch commissions");
  }

  return response.json();
}

async function fetchPartnerCustomers(
  buildUrl: BuildApiUrl,
  limit?: number,
  offset?: number,
): Promise<PartnerCustomer[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.append("limit", limit.toString());
  if (offset !== undefined) params.append("offset", offset.toString());

  const url = buildUrl(
    `/partners/portal/customers${params.toString() ? `?${params.toString()}` : ""}`,
  );
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch customers");
  }

  return response.json();
}

async function fetchPartnerStatements(
  buildUrl: BuildApiUrl,
  limit?: number,
  offset?: number,
): Promise<PartnerStatement[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.append("limit", limit.toString());
  if (offset !== undefined) params.append("offset", offset.toString());

  const url = buildUrl(
    `/partners/portal/statements${params.toString() ? `?${params.toString()}` : ""}`,
  );
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch statements");
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((statement) => ({
    id: statement.id,
    payout_id: statement.payout_id ?? statement.id ?? null,
    period_start: statement.period_start,
    period_end: statement.period_end,
    issued_at: statement.issued_at,
    revenue_total: normaliseDecimal(statement.revenue_total),
    commission_total: normaliseDecimal(statement.commission_total ?? statement.revenue_total),
    adjustments_total: normaliseDecimal(statement.adjustments_total),
    status: (statement.status || "pending").toLowerCase() as PartnerPayoutStatus,
    download_url: statement.download_url ?? null,
  }));
}

async function fetchPartnerPayoutHistory(
  buildUrl: BuildApiUrl,
  limit?: number,
  offset?: number,
): Promise<PartnerPayoutRecord[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.append("limit", limit.toString());
  if (offset !== undefined) params.append("offset", offset.toString());

  const url = buildUrl(
    `/partners/portal/payouts${params.toString() ? `?${params.toString()}` : ""}`,
  );
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch payout history");
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((payout) => ({
    id: payout.id,
    partner_id: payout.partner_id,
    total_amount: normaliseDecimal(payout.total_amount),
    currency: payout.currency ?? "USD",
    commission_count: payout.commission_count ?? 0,
    payment_reference: payout.payment_reference ?? null,
    payment_method: payout.payment_method ?? "unknown",
    status: (payout.status || "pending").toLowerCase() as PartnerPayoutStatus,
    payout_date: payout.payout_date,
    completed_at: payout.completed_at ?? null,
    period_start: payout.period_start,
    period_end: payout.period_end,
    notes: payout.notes ?? null,
    failure_reason: payout.failure_reason ?? null,
    created_at: payout.created_at,
    updated_at: payout.updated_at,
  }));
}

// Hooks
export function usePartnerDashboard() {
  const { api } = useAppConfig();
  return useQuery({
    queryKey: ["partner-portal-dashboard", api.baseUrl, api.prefix],
    queryFn: () => fetchPartnerDashboard(api.buildUrl),
  });
}

export function usePartnerProfile() {
  const { api } = useAppConfig();
  return useQuery({
    queryKey: ["partner-portal-profile", api.baseUrl, api.prefix],
    queryFn: () => fetchPartnerProfile(api.buildUrl),
  });
}

export function useUpdatePartnerProfile() {
  const { api } = useAppConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<PartnerProfile>) => updatePartnerProfile(api.buildUrl, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-portal-profile"] });
      queryClient.invalidateQueries({ queryKey: ["partner-portal-dashboard"] });
    },
  });
}

export function usePartnerReferrals(limit?: number, offset?: number) {
  const { api } = useAppConfig();
  return useQuery({
    queryKey: ["partner-portal-referrals", limit, offset, api.baseUrl, api.prefix],
    queryFn: () => fetchPartnerReferrals(api.buildUrl, limit, offset),
  });
}

export function useSubmitReferral() {
  const { api } = useAppConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof submitReferral>[1]) =>
      submitReferral(api.buildUrl, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-portal-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["partner-portal-dashboard"] });
    },
  });
}

export function usePartnerCommissions(limit?: number, offset?: number) {
  const { api } = useAppConfig();
  return useQuery({
    queryKey: ["partner-portal-commissions", limit, offset, api.baseUrl, api.prefix],
    queryFn: () => fetchPartnerCommissions(api.buildUrl, limit, offset),
  });
}

export function usePartnerCustomers(limit?: number, offset?: number) {
  const { api } = useAppConfig();
  return useQuery({
    queryKey: ["partner-portal-customers", limit, offset, api.baseUrl, api.prefix],
    queryFn: () => fetchPartnerCustomers(api.buildUrl, limit, offset),
  });
}

export function usePartnerStatements(limit?: number, offset?: number) {
  const { api } = useAppConfig();
  return useQuery({
    queryKey: ["partner-portal-statements", limit, offset, api.baseUrl, api.prefix],
    queryFn: () => fetchPartnerStatements(api.buildUrl, limit, offset),
  });
}

export function usePartnerPayoutHistory(limit?: number, offset?: number) {
  const { api } = useAppConfig();
  return useQuery({
    queryKey: ["partner-portal-payouts", limit, offset, api.baseUrl, api.prefix],
    queryFn: () => fetchPartnerPayoutHistory(api.buildUrl, limit, offset),
  });
}
