/**
 * Tenant Onboarding Service
 * Handles API calls for tenant onboarding automation
 */

import { platformConfig } from "../config";
import { Tenant } from "./tenant-service";

export interface OnboardingAdminUser {
  username: string;
  email: string;
  password: string | undefined;
  generate_password: boolean;
  full_name: string | undefined;
  roles: string[];
  send_activation_email: boolean;
}

export interface OnboardingOptions {
  apply_default_settings: boolean;
  mark_onboarding_complete: boolean;
  activate_tenant: boolean;
  allow_existing_tenant: boolean;
}

export interface TenantInvitation {
  email: string;
  role: string;
  message: string | undefined;
}

export interface TenantOnboardingRequest {
  tenant:
    | {
        name: string;
        slug: string;
        plan: string;
        contact_email: string | undefined;
        contact_phone: string | undefined;
        billing_email: string | undefined;
        address: string | undefined;
        city: string | undefined;
        state: string | undefined;
        postal_code: string | undefined;
        country: string | undefined;
      }
    | undefined;
  tenant_id: string | undefined;
  options: OnboardingOptions;
  admin_user: OnboardingAdminUser | undefined;
  settings: Array<{ key: string; value: any; value_type: string | undefined }> | undefined;
  metadata: Record<string, any> | undefined;
  invitations: TenantInvitation[] | undefined;
  feature_flags: Record<string, boolean> | undefined;
}

export interface TenantOnboardingResponse {
  tenant: Tenant;
  created: boolean;
  onboarding_status: string;
  admin_user_id: string | undefined;
  admin_user_password: string | undefined;
  invitations: any[];
  applied_settings: string[];
  metadata: Record<string, any>;
  feature_flags_updated: boolean;
  warnings: string[];
  logs: string[];
}

export interface OnboardingStatusResponse {
  tenant_id: string;
  status: string;
  completed: boolean;
  metadata: Record<string, any>;
  updated_at: string | undefined;
}

class TenantOnboardingService {
  private baseUrl = platformConfig.api.baseUrl;

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Onboard a new or existing tenant
   */
  async onboardTenant(request: TenantOnboardingRequest): Promise<TenantOnboardingResponse> {
    const response = await fetch(`${this.baseUrl}/api/platform/v1/admin/tenants/onboarding`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to onboard tenant");
    }

    return response.json();
  }

  /**
   * Get onboarding status for a tenant
   */
  async getOnboardingStatus(tenantId: string): Promise<OnboardingStatusResponse> {
    const response = await fetch(`${this.baseUrl}/api/platform/v1/admin/tenants/${tenantId}/onboarding/status`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to get onboarding status");
    }

    return response.json();
  }

  /**
   * Generate a slug from a tenant name
   */
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Generate a secure random password
   */
  generatePassword(length: number = 16): string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      const randomValue = array[i] ?? 0;
      password += charset[randomValue % charset.length];
    }
    return password;
  }
}

export const tenantOnboardingService = new TenantOnboardingService();
