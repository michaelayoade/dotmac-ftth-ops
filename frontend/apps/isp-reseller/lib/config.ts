/**
 * ISP Reseller App Configuration
 * Standalone configuration for the reseller/partner portal
 */

export interface ResellerAppConfig {
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

const API_PREFIX = "/api/isp/v1";

export const resellerAppConfig: ResellerAppConfig = {
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
    tokenKey: "reseller_access_token",
    refreshKey: "reseller_refresh_token",
  },
  app: {
    name: "Reseller Portal",
    version: "0.1.0",
  },
};

export function getConfig(): ResellerAppConfig {
  return resellerAppConfig;
}
