/**
 * Domain Verification Service
 * Handles API calls for custom domain verification
 */

import { platformConfig } from "../config";

export type VerificationMethod = "dns_txt" | "dns_cname" | "meta_tag" | "file_upload";

export interface InitiateVerificationRequest {
  domain: string;
  method: VerificationMethod;
}

export interface CheckVerificationRequest {
  domain: string;
  token: string;
  method: VerificationMethod;
}

export interface DNSRecordInstruction {
  type: string;
  name: string;
  value?: string;
  target?: string;
  ttl: number;
}

export interface DomainVerificationInstructions {
  type: string;
  description: string;
  steps: string[];
  dns_record?: DNSRecordInstruction;
  verification_command?: string;
}

export interface DomainVerificationResponse {
  domain: string;
  status: "pending" | "verified" | "failed" | "expired";
  method: string;
  token?: string;
  expires_at?: string;
  verified_at?: string;
  instructions?: DomainVerificationInstructions;
  error_message?: string;
}

export interface DomainVerificationStatusResponse {
  tenant_id: string;
  domain: string | null;
  is_verified: boolean;
  verified_at?: string;
}

export interface DomainRemovalResponse {
  domain: string;
  status: string;
  removed_at: string;
}

class DomainVerificationService {
  private baseUrl = platformConfig.api.baseUrl;

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Initiate domain verification process
   */
  async initiateVerification(
    tenantId: string,
    request: InitiateVerificationRequest,
  ): Promise<DomainVerificationResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/platform/v1/admin/tenants/${tenantId}/domains/verify`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to initiate domain verification");
    }

    return response.json();
  }

  /**
   * Check domain verification status
   */
  async checkVerification(
    tenantId: string,
    request: CheckVerificationRequest,
  ): Promise<DomainVerificationResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/platform/v1/admin/tenants/${tenantId}/domains/check`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to check domain verification");
    }

    return response.json();
  }

  /**
   * Get current domain verification status
   */
  async getStatus(tenantId: string): Promise<DomainVerificationStatusResponse> {
    const response = await fetch(`${this.baseUrl}/api/platform/v1/admin/tenants/${tenantId}/domains/status`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to get domain status");
    }

    return response.json();
  }

  /**
   * Remove verified domain
   */
  async removeDomain(tenantId: string): Promise<DomainRemovalResponse> {
    const response = await fetch(`${this.baseUrl}/api/platform/v1/admin/tenants/${tenantId}/domains`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to remove domain");
    }

    return response.json();
  }

  /**
   * Validate domain format
   */
  validateDomain(domain: string): { valid: boolean; error?: string } {
    if (!domain || domain.trim().length === 0) {
      return { valid: false, error: "Domain cannot be empty" };
    }

    const trimmed = domain.trim().toLowerCase();

    // Check for whitespace
    if (/\s/.test(trimmed)) {
      return { valid: false, error: "Domain cannot contain whitespace" };
    }

    // Basic domain pattern check
    const domainPattern =
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
    if (!domainPattern.test(trimmed)) {
      return { valid: false, error: "Invalid domain format" };
    }

    // Check length
    if (trimmed.length < 3 || trimmed.length > 255) {
      return {
        valid: false,
        error: "Domain must be between 3 and 255 characters",
      };
    }

    return { valid: true };
  }
}

export const domainVerificationService = new DomainVerificationService();
