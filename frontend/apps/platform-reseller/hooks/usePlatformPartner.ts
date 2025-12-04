"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformResellerConfig } from "@/lib/config";
import { getPartnerToken } from "@/lib/auth/token-utils";

// Types - Platform partners sell ISP subscriptions (tenants)
export interface PartnerDashboardStats {
  total_tenants: number;
  active_tenants: number;
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

export interface PartnerTenant {
  id: string;
  tenant_id: string;
  tenant_name: string;
  plan: string;
  status: "active" | "trialing" | "past_due" | "canceled";
  mrr: number;
  total_revenue: number;
  total_commissions: number;
  start_date: string;
  is_active: boolean;
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
  tenant_id: string;
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

function getAuthHeaders(): HeadersInit {
  const token = getPartnerToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function normaliseDecimal(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

// API Functions
async function fetchPartnerDashboard(): Promise<PartnerDashboardStats> {
  const response = await fetch(
    platformResellerConfig.api.buildUrl("/partners/portal/dashboard"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch dashboard");
  return response.json();
}

async function fetchPartnerProfile(): Promise<PartnerProfile> {
  const response = await fetch(
    platformResellerConfig.api.buildUrl("/partners/portal/profile"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch profile");
  return response.json();
}

async function fetchPartnerTenants(): Promise<PartnerTenant[]> {
  const response = await fetch(
    platformResellerConfig.api.buildUrl("/partners/portal/tenants"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch tenants");
  return response.json();
}

async function fetchPartnerReferrals(): Promise<PartnerReferral[]> {
  const response = await fetch(
    platformResellerConfig.api.buildUrl("/partners/portal/referrals"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch referrals");
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
    platformResellerConfig.api.buildUrl("/partners/portal/referrals"),
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to submit referral");
  }
  return response.json();
}

async function fetchPartnerCommissions(): Promise<PartnerCommission[]> {
  const response = await fetch(
    platformResellerConfig.api.buildUrl("/partners/portal/commissions"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch commissions");
  return response.json();
}

async function fetchPartnerStatements(): Promise<PartnerStatement[]> {
  const response = await fetch(
    platformResellerConfig.api.buildUrl("/partners/portal/statements"),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch statements");
  const payload = await response.json();
  if (!Array.isArray(payload)) return [];

  return payload.map((statement) => ({
    id: statement.id,
    payout_id: statement.payout_id ?? null,
    period_start: statement.period_start,
    period_end: statement.period_end,
    issued_at: statement.issued_at,
    revenue_total: normaliseDecimal(statement.revenue_total),
    commission_total: normaliseDecimal(statement.commission_total),
    adjustments_total: normaliseDecimal(statement.adjustments_total),
    status: (statement.status || "pending").toLowerCase() as PartnerPayoutStatus,
    download_url: statement.download_url ?? null,
  }));
}

// Hooks
export function usePartnerDashboard() {
  return useQuery({
    queryKey: ["platform-partner-dashboard"],
    queryFn: fetchPartnerDashboard,
  });
}

export function usePartnerProfile() {
  return useQuery({
    queryKey: ["platform-partner-profile"],
    queryFn: fetchPartnerProfile,
  });
}

export function usePartnerTenants() {
  return useQuery({
    queryKey: ["platform-partner-tenants"],
    queryFn: fetchPartnerTenants,
  });
}

export function usePartnerReferrals() {
  return useQuery({
    queryKey: ["platform-partner-referrals"],
    queryFn: fetchPartnerReferrals,
  });
}

export function useSubmitReferral() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitReferral,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-partner-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["platform-partner-dashboard"] });
    },
  });
}

export function usePartnerCommissions() {
  return useQuery({
    queryKey: ["platform-partner-commissions"],
    queryFn: fetchPartnerCommissions,
  });
}

export function usePartnerStatements() {
  return useQuery({
    queryKey: ["platform-partner-statements"],
    queryFn: fetchPartnerStatements,
  });
}
