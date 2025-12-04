/**
 * Platform Tenant App Configuration
 * Standalone configuration for the ISP owner/tenant portal
 */

export interface TenantAppConfig {
  api: {
    baseUrl: string;
    prefix: string;
    buildUrl: (path: string) => string;
  };
  auth: {
    loginPath: string;
    portalPath: string;
    tokenKey: string;
    refreshKey: string;
  };
  app: {
    name: string;
    version: string;
  };
}

function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:8000";
}

const API_PREFIX = "/api/platform/v1";

export const tenantAppConfig: TenantAppConfig = {
  api: {
    baseUrl: getApiBaseUrl(),
    prefix: API_PREFIX,
    buildUrl: (path: string) => {
      const baseUrl = getApiBaseUrl();
      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      return `${baseUrl}${API_PREFIX}${cleanPath}`;
    },
  },
  auth: {
    loginPath: "/login",
    portalPath: "/portal",
    tokenKey: "tenant_access_token",
    refreshKey: "tenant_refresh_token",
  },
  app: {
    name: "Tenant Portal",
    version: "0.1.0",
  },
};

export function getConfig(): TenantAppConfig {
  return tenantAppConfig;
}
