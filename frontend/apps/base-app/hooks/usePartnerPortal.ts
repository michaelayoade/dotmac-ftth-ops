"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;

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
async function fetchPartnerDashboard(): Promise<PartnerDashboardStats> {
  const response = await fetch(`${API_BASE}/api/v1/partners/portal/dashboard`, {
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

async function fetchPartnerProfile(): Promise<PartnerProfile> {
  const response = await fetch(`${API_BASE}/api/v1/partners/portal/profile`, {
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
  data: Partial<PartnerProfile>
): Promise<PartnerProfile> {
  const response = await fetch(`${API_BASE}/api/v1/partners/portal/profile`, {
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

async function fetchPartnerReferrals(limit?: number, offset?: number): Promise<PartnerReferral[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.append("limit", limit.toString());
  if (offset !== undefined) params.append("offset", offset.toString());

  const url = `${API_BASE}/api/v1/partners/portal/referrals${params.toString() ? `?${params.toString()}` : ""}`;
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

async function submitReferral(data: {
  lead_name: string;
  lead_email: string;
  lead_phone?: string;
  company_name?: string;
  estimated_value?: number;
  notes?: string;
}): Promise<PartnerReferral> {
  const response = await fetch(
    `${API_BASE}/api/v1/partners/portal/referrals`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to submit referral");
  }

  return response.json();
}

async function fetchPartnerCommissions(limit?: number, offset?: number): Promise<PartnerCommission[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.append("limit", limit.toString());
  if (offset !== undefined) params.append("offset", offset.toString());

  const url = `${API_BASE}/api/v1/partners/portal/commissions${params.toString() ? `?${params.toString()}` : ""}`;
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

async function fetchPartnerCustomers(limit?: number, offset?: number): Promise<PartnerCustomer[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.append("limit", limit.toString());
  if (offset !== undefined) params.append("offset", offset.toString());

  const url = `${API_BASE}/api/v1/partners/portal/customers${params.toString() ? `?${params.toString()}` : ""}`;
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

async function fetchPartnerStatements(limit?: number, offset?: number): Promise<PartnerStatement[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.append("limit", limit.toString());
  if (offset !== undefined) params.append("offset", offset.toString());

  const url = `${API_BASE}/api/v1/partners/portal/statements${params.toString() ? `?${params.toString()}` : ""}`;
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
    commission_total: normaliseDecimal(
      statement.commission_total ?? statement.revenue_total
    ),
    adjustments_total: normaliseDecimal(statement.adjustments_total),
    status: (statement.status || "pending").toLowerCase() as PartnerPayoutStatus,
    download_url: statement.download_url ?? null,
  }));
}

async function fetchPartnerPayoutHistory(limit?: number, offset?: number): Promise<PartnerPayoutRecord[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.append("limit", limit.toString());
  if (offset !== undefined) params.append("offset", offset.toString());

  const url = `${API_BASE}/api/v1/partners/portal/payouts${params.toString() ? `?${params.toString()}` : ""}`;
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
  return useQuery({
    queryKey: ["partner-portal-dashboard"],
    queryFn: fetchPartnerDashboard,
  });
}

export function usePartnerProfile() {
  return useQuery({
    queryKey: ["partner-portal-profile"],
    queryFn: fetchPartnerProfile,
  });
}

export function useUpdatePartnerProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePartnerProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-portal-profile"] });
      queryClient.invalidateQueries({ queryKey: ["partner-portal-dashboard"] });
    },
  });
}

export function usePartnerReferrals(limit?: number, offset?: number) {
  return useQuery({
    queryKey: ["partner-portal-referrals", limit, offset],
    queryFn: () => fetchPartnerReferrals(limit, offset),
  });
}

export function useSubmitReferral() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitReferral,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-portal-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["partner-portal-dashboard"] });
    },
  });
}

export function usePartnerCommissions(limit?: number, offset?: number) {
  return useQuery({
    queryKey: ["partner-portal-commissions", limit, offset],
    queryFn: () => fetchPartnerCommissions(limit, offset),
  });
}

export function usePartnerCustomers(limit?: number, offset?: number) {
  return useQuery({
    queryKey: ["partner-portal-customers", limit, offset],
    queryFn: () => fetchPartnerCustomers(limit, offset),
  });
}

export function usePartnerStatements(limit?: number, offset?: number) {
  return useQuery({
    queryKey: ["partner-portal-statements", limit, offset],
    queryFn: () => fetchPartnerStatements(limit, offset),
  });
}

export function usePartnerPayoutHistory(limit?: number, offset?: number) {
  return useQuery({
    queryKey: ["partner-portal-payouts", limit, offset],
    queryFn: () => fetchPartnerPayoutHistory(limit, offset),
  });
}
