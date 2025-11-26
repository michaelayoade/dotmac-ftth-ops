"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlatformConfig } from "@/lib/config";
import { useAppConfig } from "@/providers/AppConfigContext";

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

// Workflow-specific types
export interface QuotaCheckResult {
  available: boolean;
  quota_remaining: number;
  quota_allocated: number | "unlimited";
  quota_used: number;
  requested_licenses: number;
  partner_id: string;
  partner_number: string;
  partner_name: string;
  partner_status: string;
  partner_tier: string;
  can_allocate: boolean;
  is_unlimited: boolean;
  checked_at: string;
}

export interface PartnerCustomerInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  tier?: string;
  service_address?: string;
  billing_address?: string;
}

export interface PartnerCustomerResult {
  customer_id: string;
  customer_number: string;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  tier: string;
  partner_id: string;
  partner_number: string;
  partner_name: string;
  partner_account_id: string;
  engagement_type: string;
  commission_rate: string;
  quota_remaining: number;
  created_at: string;
}

export interface LicenseAllocationInput {
  partner_id: string;
  customer_id: string;
  license_template_id: string;
  license_count?: number;
  tenant_id?: string;
  metadata?: Record<string, any>;
}

export interface LicenseAllocationResult {
  partner_id: string;
  partner_name: string;
  customer_id: string;
  licenses_allocated: number;
  license_keys: string[];
  license_ids: string[];
  template_id: string;
  template_name: string;
  product_id: string;
  quota_before: number;
  quota_after: number;
  quota_remaining: number;
  allocated_at: string;
  status: string;
  engagement_type: string;
}

export interface TenantProvisioningInput {
  customer_id: string;
  partner_id: string;
  license_key: string;
  deployment_type: string;
  white_label_config?: {
    company_name?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    custom_domain?: string;
    support_email?: string;
    support_phone?: string;
  };
  tenant_id?: number;
  environment?: string;
  region?: string;
}

export interface TenantProvisioningResult {
  tenant_url: string;
  tenant_id: number;
  instance_id: string;
  deployment_type: string;
  partner_id: string;
  partner_number: string;
  partner_name: string;
  white_label_applied: boolean;
  white_label_config?: Record<string, any>;
  custom_domain?: string;
  engagement_type: string;
  status: string;
  allocated_resources: {
    cpu: number;
    memory_gb: number;
    storage_gb: number;
  };
  endpoints: Record<string, string>;
  health_check_url?: string;
  provisioned_at: string;
}

export interface CommissionRecordInput {
  partner_id: string;
  customer_id: string;
  commission_type: "new_customer" | "renewal" | "upgrade" | "usage" | "referral";
  amount: number | string;
  invoice_id?: string;
  tenant_id?: string;
  currency?: string;
  metadata?: Record<string, any>;
}

type BuildApiUrl = PlatformConfig["api"]["buildUrl"];

export interface CommissionRecordResult {
  commission_id: string;
  partner_id: string;
  partner_number: string;
  partner_name: string;
  customer_id: string;
  commission_type: string;
  amount: string;
  currency: string;
  status: string;
  event_date: string;
  invoice_id?: string;
  partner_balance: string;
  partner_outstanding_balance: string;
  metadata?: Record<string, any>;
}

export interface PartnerOnboardingInput {
  partner_data: CreatePartnerInput;
  customer_data: PartnerCustomerInput;
  license_template_id: string;
  deployment_type: string;
  white_label_config?: TenantProvisioningInput["white_label_config"];
  environment?: string;
  region?: string;
}

export interface PartnerOnboardingResult {
  partner: Partner;
  customer: PartnerCustomerResult;
  licenses: LicenseAllocationResult;
  tenant: TenantProvisioningResult;
  commission?: CommissionRecordResult;
  workflow_id: string;
  status: string;
  completed_at: string;
}

// API functions
async function fetchPartners(
  buildUrl: BuildApiUrl,
  status?: string,
  page: number = 1,
  pageSize: number = 50,
): Promise<PartnerListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });

  if (status) {
    params.append("status", status);
  }

  const response = await fetch(buildUrl(`/partners?${params.toString()}`), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch partners");
  }

  return response.json();
}

async function fetchPartner(buildUrl: BuildApiUrl, partnerId: string): Promise<Partner> {
  const response = await fetch(buildUrl(`/partners/${partnerId}`), {
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

async function createPartner(buildUrl: BuildApiUrl, data: CreatePartnerInput): Promise<Partner> {
  const response = await fetch(buildUrl("/partners"), {
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
  buildUrl: BuildApiUrl,
  partnerId: string,
  data: UpdatePartnerInput,
): Promise<Partner> {
  const response = await fetch(buildUrl(`/partners/${partnerId}`), {
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

async function deletePartner(buildUrl: BuildApiUrl, partnerId: string): Promise<void> {
  const response = await fetch(buildUrl(`/partners/${partnerId}`), {
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

// Workflow API functions
async function checkLicenseQuota(
  buildUrl: BuildApiUrl,
  partnerId: string,
  requestedLicenses: number,
  tenantId?: string,
): Promise<QuotaCheckResult> {
  const params = new URLSearchParams({
    requested_licenses: requestedLicenses.toString(),
  });

  if (tenantId) {
    params.append("tenant_id", tenantId);
  }

  const response = await fetch(
    buildUrl(`/partners/${partnerId}/quota/check?${params.toString()}`),
    {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to check license quota");
  }

  return response.json();
}

async function createPartnerCustomer(
  buildUrl: BuildApiUrl,
  partnerId: string,
  customerData: PartnerCustomerInput,
  engagementType: string = "managed",
  customCommissionRate?: number,
  tenantId?: string,
): Promise<PartnerCustomerResult> {
  const response = await fetch(buildUrl(`/partners/${partnerId}/customers`), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer_data: customerData,
      engagement_type: engagementType,
      custom_commission_rate: customCommissionRate,
      tenant_id: tenantId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to create partner customer");
  }

  return response.json();
}

async function allocateLicensesFromPartner(
  buildUrl: BuildApiUrl,
  data: LicenseAllocationInput,
): Promise<LicenseAllocationResult> {
  const response = await fetch(buildUrl(`/partners/${data.partner_id}/licenses/allocate`), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer_id: data.customer_id,
      license_template_id: data.license_template_id,
      license_count: data.license_count || 1,
      tenant_id: data.tenant_id,
      metadata: data.metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to allocate licenses");
  }

  return response.json();
}

async function provisionPartnerTenant(
  buildUrl: BuildApiUrl,
  data: TenantProvisioningInput,
): Promise<TenantProvisioningResult> {
  const response = await fetch(buildUrl(`/partners/${data.partner_id}/tenants/provision`), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer_id: data.customer_id,
      license_key: data.license_key,
      deployment_type: data.deployment_type,
      white_label_config: data.white_label_config,
      tenant_id: data.tenant_id,
      environment: data.environment || "production",
      region: data.region,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to provision partner tenant");
  }

  return response.json();
}

async function recordPartnerCommission(
  buildUrl: BuildApiUrl,
  data: CommissionRecordInput,
): Promise<CommissionRecordResult> {
  const response = await fetch(buildUrl(`/partners/${data.partner_id}/commissions`), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer_id: data.customer_id,
      commission_type: data.commission_type,
      amount: data.amount,
      invoice_id: data.invoice_id,
      tenant_id: data.tenant_id,
      currency: data.currency || "USD",
      metadata: data.metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to record commission");
  }

  return response.json();
}

async function completePartnerOnboarding(
  buildUrl: BuildApiUrl,
  data: PartnerOnboardingInput,
): Promise<PartnerOnboardingResult> {
  const response = await fetch(buildUrl("/partners/onboarding/complete"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to complete partner onboarding");
  }

  return response.json();
}

// Hooks
export function usePartners(status?: string, page: number = 1, pageSize: number = 50) {
  const { api } = useAppConfig();
  return useQuery({
    queryKey: ["partners", status, page, pageSize, api.baseUrl, api.prefix],
    queryFn: () => fetchPartners(api.buildUrl, status, page, pageSize),
  });
}

export function usePartner(partnerId: string | undefined) {
  const { api } = useAppConfig();
  return useQuery({
    queryKey: ["partner", partnerId, api.baseUrl, api.prefix],
    queryFn: () => fetchPartner(api.buildUrl, partnerId!),
    enabled: !!partnerId,
  });
}

export function useCreatePartner() {
  const { api } = useAppConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePartnerInput) => createPartner(api.buildUrl, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
  });
}

export function useUpdatePartner() {
  const { api } = useAppConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ partnerId, data }: { partnerId: string; data: UpdatePartnerInput }) =>
      updatePartner(api.buildUrl, partnerId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({
        queryKey: ["partner", variables.partnerId],
      });
    },
  });
}

export function useDeletePartner() {
  const { api } = useAppConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partnerId: string) => deletePartner(api.buildUrl, partnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
  });
}

// Workflow hooks
export function useCheckLicenseQuota() {
  const { api } = useAppConfig();
  return useMutation({
    mutationFn: ({
      partnerId,
      requestedLicenses,
      tenantId,
    }: {
      partnerId: string;
      requestedLicenses: number;
      tenantId?: string;
    }) => checkLicenseQuota(api.buildUrl, partnerId, requestedLicenses, tenantId),
  });
}

export function useCreatePartnerCustomer() {
  const { api } = useAppConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      partnerId,
      customerData,
      engagementType,
      customCommissionRate,
      tenantId,
    }: {
      partnerId: string;
      customerData: PartnerCustomerInput;
      engagementType?: string;
      customCommissionRate?: number;
      tenantId?: string;
    }) =>
      createPartnerCustomer(
        api.buildUrl,
        partnerId,
        customerData,
        engagementType,
        customCommissionRate,
        tenantId,
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({
        queryKey: ["partner", variables.partnerId],
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useAllocateLicenses() {
  const { api } = useAppConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LicenseAllocationInput) => allocateLicensesFromPartner(api.buildUrl, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner", data.partner_id] });
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      queryClient.invalidateQueries({
        queryKey: ["customer", data.customer_id],
      });
    },
  });
}

export function useProvisionPartnerTenant() {
  const { api } = useAppConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TenantProvisioningInput) => provisionPartnerTenant(api.buildUrl, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner", data.partner_id] });
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useRecordCommission() {
  const { api } = useAppConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CommissionRecordInput) => recordPartnerCommission(api.buildUrl, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner", data.partner_id] });
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
    },
  });
}

export function useCompletePartnerOnboarding() {
  const { api } = useAppConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PartnerOnboardingInput) => completePartnerOnboarding(api.buildUrl, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner", data.partner.id] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
    },
  });
}
