/**
 * Customer Portal Configuration
 *
 * Simplified configuration for the customer-facing portal.
 * Only includes what's necessary for customer self-service functionality.
 */

const DEFAULT_API_PREFIX = "/api/isp/v1";

const rawApiBaseUrl =
  process.env["NEXT_PUBLIC_API_BASE_URL"] ??
  process.env["NEXT_PUBLIC_API_URL"] ??
  (process.env["NODE_ENV"] === "test" ? "http://localhost:3000" : "");

const apiBaseUrl = sanitizeBaseUrl(rawApiBaseUrl);
const apiPrefix = normalizeApiPrefix(process.env["NEXT_PUBLIC_API_PREFIX"] ?? DEFAULT_API_PREFIX);

type BuildApiUrlOptions = {
  skipPrefix?: boolean;
};

const buildApiUrl = (path: string, options: BuildApiUrlOptions = {}): string => {
  return combineApiUrl(apiBaseUrl, apiPrefix, path, options);
};

export const customerConfig = {
  /**
   * API configuration
   */
  api: {
    baseUrl: apiBaseUrl,
    prefix: apiPrefix,
    timeout: 30000,
    buildUrl: buildApiUrl,
  },

  /**
   * Application metadata
   */
  app: {
    name: process.env["NEXT_PUBLIC_APP_NAME"] || "Customer Portal",
    version: process.env["NEXT_PUBLIC_APP_VERSION"] || "1.0.0",
    environment: process.env["NEXT_PUBLIC_ENVIRONMENT"] || "development",
    type: "isp-customer",
    portalType: "customer",
  },

  /**
   * Tenant information
   */
  tenant: {
    id: process.env["NEXT_PUBLIC_TENANT_ID"] || null,
    slug: process.env["NEXT_PUBLIC_TENANT_SLUG"] || null,
    name: process.env["NEXT_PUBLIC_TENANT_NAME"] || "Your ISP",
  },

  /**
   * Branding configuration
   */
  branding: {
    companyName: process.env["NEXT_PUBLIC_COMPANY_NAME"] || "Your ISP",
    productName: process.env["NEXT_PUBLIC_PRODUCT_NAME"] || "Customer Portal",
    logoUrl: process.env["NEXT_PUBLIC_LOGO_URL"] || "/logo.svg",
    supportEmail: process.env["NEXT_PUBLIC_SUPPORT_EMAIL"] || "support@example.com",
    supportPhone: process.env["NEXT_PUBLIC_SUPPORT_PHONE"] || "",
    termsUrl: process.env["NEXT_PUBLIC_TERMS_URL"] || "/terms",
    privacyUrl: process.env["NEXT_PUBLIC_PRIVACY_URL"] || "/privacy",
    colors: {
      primary: process.env["NEXT_PUBLIC_PRIMARY_COLOR"] || "#0ea5e9",
      primaryForeground: process.env["NEXT_PUBLIC_PRIMARY_FOREGROUND_COLOR"] || "#ffffff",
    },
  },
};

export type CustomerConfig = typeof customerConfig;

export default customerConfig;

// Utility functions

function sanitizeBaseUrl(value?: string | null): string {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  return withoutTrailingSlash.replace(/\/api(?:\/v1)?$/i, "");
}

function normalizeApiPrefix(value: string): string {
  if (!value) {
    return DEFAULT_API_PREFIX;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_API_PREFIX;
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function ensureLeadingSlash(path: string): string {
  if (!path) {
    return "";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function combineApiUrl(
  baseUrl: string,
  prefix: string,
  path: string,
  options: BuildApiUrlOptions = {},
): string {
  const normalizedPath = ensureLeadingSlash(path);
  const normalizedPrefix = prefix ? ensureLeadingSlash(prefix).replace(/\/+$/, "") : "";

  const shouldApplyPrefix = !options.skipPrefix && Boolean(normalizedPrefix);
  const hasPrefix =
    normalizedPath &&
    normalizedPrefix &&
    (normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`));

  let pathWithPrefix: string;

  if (!normalizedPath) {
    pathWithPrefix = shouldApplyPrefix ? normalizedPrefix : "/";
  } else if (shouldApplyPrefix && !hasPrefix) {
    pathWithPrefix =
      normalizedPath === "/" ? normalizedPrefix || "/" : `${normalizedPrefix}${normalizedPath}`;
  } else {
    pathWithPrefix = normalizedPath;
  }

  if (!baseUrl) {
    return pathWithPrefix;
  }

  return `${baseUrl}${pathWithPrefix}`;
}
