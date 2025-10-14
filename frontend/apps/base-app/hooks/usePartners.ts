"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;

// Types
export interface Partner {
  id: string;
  partner_number: string;
  company_name: string;
  legal_name?: string;
  website?: string;
  status: "pending" | "active" | "suspended" | "terminated" | "archived";
  tier: "bronze" | "silver" | "gold" | "platinum" | "direct";
  commission_model: "revenue_share" | "flat_fee" | "tiered" | "hybrid";
  default_commission_rate?: number;
  primary_email: string;
  billing_email?: string;
  phone?: string;
  total_customers: number;
  total_revenue_generated: number;
  total_commissions_earned: number;
  total_commissions_paid: number;
  total_referrals: number;
  converted_referrals: number;
  created_at: string;
  updated_at: string;
}

export interface PartnerListResponse {
  partners: Partner[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreatePartnerInput {
  company_name: string;
  legal_name?: string;
  website?: string;
  primary_email: string;
  billing_email?: string;
  phone?: string;
  tier?: "bronze" | "silver" | "gold" | "platinum" | "direct";
  commission_model?: "revenue_share" | "flat_fee" | "tiered" | "hybrid";
  default_commission_rate?: number;
  address_line1?: string;
  city?: string;
  state_province?: string;
  country?: string;
}

export interface UpdatePartnerInput {
  company_name?: string;
  status?: "pending" | "active" | "suspended" | "terminated";
  tier?: "bronze" | "silver" | "gold" | "platinum" | "direct";
  default_commission_rate?: number;
  billing_email?: string;
  phone?: string;
}

// API functions
async function fetchPartners(
  status?: string,
  page: number = 1,
  pageSize: number = 50
): Promise<PartnerListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });

  if (status) {
    params.append("status", status);
  }

  const response = await fetch(
    `${API_BASE}/api/v1/partners?${params.toString()}`,
    {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch partners");
  }

  return response.json();
}

async function fetchPartner(partnerId: string): Promise<Partner> {
  const response = await fetch(`${API_BASE}/api/v1/partners/${partnerId}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch partner");
  }

  return response.json();
}

async function createPartner(data: CreatePartnerInput): Promise<Partner> {
  const response = await fetch(`${API_BASE}/api/v1/partners`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to create partner");
  }

  return response.json();
}

async function updatePartner(
  partnerId: string,
  data: UpdatePartnerInput
): Promise<Partner> {
  const response = await fetch(`${API_BASE}/api/v1/partners/${partnerId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to update partner");
  }

  return response.json();
}

async function deletePartner(partnerId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/partners/${partnerId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to delete partner");
  }
}

// Hooks
export function usePartners(
  status?: string,
  page: number = 1,
  pageSize: number = 50
) {
  return useQuery({
    queryKey: ["partners", status, page, pageSize],
    queryFn: () => fetchPartners(status, page, pageSize),
  });
}

export function usePartner(partnerId: string | undefined) {
  return useQuery({
    queryKey: ["partner", partnerId],
    queryFn: () => fetchPartner(partnerId!),
    enabled: !!partnerId,
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPartner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
  });
}

export function useUpdatePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ partnerId, data }: { partnerId: string; data: UpdatePartnerInput }) =>
      updatePartner(partnerId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner", variables.partnerId] });
    },
  });
}

export function useDeletePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePartner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
  });
}
