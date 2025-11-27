/**
 * MSW Handlers for Tenant Branding API
 * Mocks tenant branding configuration endpoints
 */

import { http, HttpResponse } from "msw";
import type { TenantBrandingConfigDto, TenantBrandingResponseDto } from "@/hooks/useTenantBranding";

// ============================================
// In-Memory Storage
// ============================================

let brandingConfigs: Map<string, TenantBrandingResponseDto> = new Map();

// ============================================
// Mock Data Generators
// ============================================

export function createMockBranding(
  tenantId: string,
  overrides: Partial<TenantBrandingConfigDto> = {},
): TenantBrandingResponseDto {
  return {
    tenant_id: tenantId,
    branding: {
      product_name: "DotMac Platform",
      product_tagline: "Manage your network infrastructure",
      company_name: "DotMac Inc.",
      support_email: "support@dotmac.com",
      success_email: null,
      operations_email: null,
      partner_support_email: null,
      primary_color: "#007bff",
      secondary_color: "#6c757d",
      accent_color: "#28a745",
      logo_light_url: "/logos/dotmac-light.png",
      logo_dark_url: "/logos/dotmac-dark.png",
      favicon_url: "/favicon.ico",
      docs_url: "https://docs.dotmac.com",
      support_portal_url: "https://support.dotmac.com",
      status_page_url: "https://status.dotmac.com",
      terms_url: "https://dotmac.com/terms",
      privacy_url: "https://dotmac.com/privacy",
      ...overrides,
    },
    updated_at: new Date().toISOString(),
  };
}

// ============================================
// Storage Helpers
// ============================================

export function seedBrandingData(
  tenantId: string,
  branding: Partial<TenantBrandingConfigDto>,
): void {
  brandingConfigs.set(tenantId, createMockBranding(tenantId, branding));
}

export function clearBrandingData(): void {
  brandingConfigs.clear();
}

export function getBranding(tenantId: string): TenantBrandingResponseDto | undefined {
  return brandingConfigs.get(tenantId);
}

// ============================================
// MSW Handlers
// ============================================

export const brandingHandlers = [
  // GET /api/v1/branding - Get tenant branding
  http.get("*/api/v1/branding", ({ request }) => {
    // In real API, tenant would be determined by auth token
    // For testing, we'll use a default tenant or the first one available
    const tenantId = "tenant-123"; // Default test tenant

    let branding = brandingConfigs.get(tenantId);

    // If no branding exists, create default
    if (!branding) {
      branding = createMockBranding(tenantId);
      brandingConfigs.set(tenantId, branding);
    }

    console.log("[MSW] GET /api/v1/branding - returning:", {
      product_name: branding.branding.product_name,
      primary_color: branding.branding.primary_color,
      hasSeededData: brandingConfigs.has(tenantId),
    });

    return HttpResponse.json(branding);
  }),

  // PUT /api/v1/branding - Update tenant branding
  http.put("*/api/v1/branding", async (req) => {
    const tenantId = "tenant-123"; // Default test tenant
    const body = await req.json<{ branding: TenantBrandingConfigDto }>();

    const existingBranding = brandingConfigs.get(tenantId) || createMockBranding(tenantId);

    // Merge updates with existing config
    const updatedBranding: TenantBrandingResponseDto = {
      tenant_id: tenantId,
      branding: {
        ...existingBranding.branding,
        ...body.branding,
      },
      updated_at: new Date().toISOString(),
    };

    brandingConfigs.set(tenantId, updatedBranding);

    return HttpResponse.json(updatedBranding);
  }),
];
