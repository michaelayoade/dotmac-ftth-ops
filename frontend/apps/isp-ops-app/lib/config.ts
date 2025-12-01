import type { RuntimeConfig } from "../../../shared/runtime/runtime-config";
import { getRuntimeConfigSnapshot } from "../../../shared/runtime/runtime-config";

/**
 * Application Configuration
 *
 * Centralized configuration for the frontend application.
 */

const DEFAULT_API_PREFIX = "/api/isp/v1/admin";

const rawApiBaseUrl =
  process.env["NEXT_PUBLIC_API_BASE_URL"] ??
  process.env["NEXT_PUBLIC_API_URL"] ??
  (process.env["NODE_ENV"] === "test" ? "http://localhost:3000" : "");
let apiBaseUrl = sanitizeBaseUrl(rawApiBaseUrl);
let apiPrefix = normalizeApiPrefix(process.env["NEXT_PUBLIC_API_PREFIX"] ?? DEFAULT_API_PREFIX);

type BuildApiUrlOptions = {
  skipPrefix?: boolean;
};

const buildApiUrl = (path: string, options: BuildApiUrlOptions = {}): string => {
  return combineApiUrl(apiBaseUrl, apiPrefix, path, options);
};

const buildApiPath = (path: string, options: BuildApiUrlOptions = {}): string => {
  return combineApiUrl("", apiPrefix, path, options);
};

const FEATURE_FLAG_KEY_MAP: Record<string, string> = {
  graphql_enabled: "enableGraphQL",
  analytics_enabled: "enableAnalytics",
  banking_enabled: "enableBanking",
  payments_enabled: "enablePayments",
  network_enabled: "enableNetwork",
  automation_enabled: "enableAutomation",
  radius_enabled: "enableRadius",
};

/**
 * Platform configuration (alias for backwards compatibility)
 */
const defaultBranding = buildBrandingConfig();

export const platformConfig = {
  /**
   * API configuration
   */
  api: {
    // Empty string - all API calls use full paths like /api/isp/v1/admin/...
    // Next.js rewrites in next.config.mjs proxy these to the backend
    baseUrl: apiBaseUrl,
    prefix: apiPrefix,
    timeout: 30000,
    buildUrl: buildApiUrl,
    buildPath: buildApiPath,
    graphqlEndpoint: buildApiUrl("/graphql"),
  },

  /**
   * Feature flags
   */
  features: {
    enableGraphQL: process.env["NEXT_PUBLIC_ENABLE_GRAPHQL"] === "true",
    enableAnalytics: process.env["NEXT_PUBLIC_ENABLE_ANALYTICS"] === "true",
    enableBanking: process.env["NEXT_PUBLIC_ENABLE_BANKING"] === "true",
    enablePayments: process.env["NEXT_PUBLIC_ENABLE_PAYMENTS"] === "true",
    enableRadius: process.env["NEXT_PUBLIC_ENABLE_RADIUS"] !== "false",
    enableNetwork: process.env["NEXT_PUBLIC_ENABLE_NETWORK"] !== "false",
    enableAutomation: process.env["NEXT_PUBLIC_ENABLE_AUTOMATION"] !== "false",
  },

  /**
   * Application metadata
   */
  app: {
    name: process.env["NEXT_PUBLIC_APP_NAME"] || "DotMac Platform",
    version: process.env["NEXT_PUBLIC_APP_VERSION"] || "1.0.0",
    environment: process.env["NEXT_PUBLIC_ENVIRONMENT"] || "development",
  },

  tenant: {
    id: process.env["NEXT_PUBLIC_TENANT_ID"] || null,
    slug: process.env["TENANT_SLUG"] || null,
    name:
      process.env["NEXT_PUBLIC_TENANT_NAME"] ||
      process.env["NEXT_PUBLIC_PRODUCT_NAME"] ||
      "DotMac Platform",
  },

  /**
   * Banking configuration
   */
  banking: {
    enabled: process.env["NEXT_PUBLIC_ENABLE_BANKING"] === "true",
    providers: (process.env["NEXT_PUBLIC_BANKING_PROVIDERS"] || "stripe,paypal").split(","),
  },

  /**
   * Pagination defaults
   */
  pagination: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
  },

  /**
   * Date/time formats
   */
  formats: {
    date: "yyyy-MM-dd",
    dateTime: "yyyy-MM-dd HH:mm:ss",
    time: "HH:mm:ss",
  },

  /**
   * Branding configuration
   */
  branding: defaultBranding,

  realtime: {
    wsUrl: process.env["NEXT_PUBLIC_WS_URL"] || "",
    sseUrl: process.env["NEXT_PUBLIC_SSE_URL"] || buildApiPath("/realtime/events"),
    alertsChannel: `tenant-${process.env["TENANT_SLUG"] || "global"}`,
  },

  deployment: {
    mode: process.env["DEPLOYMENT_MODE"] || "multi_tenant",
    tenantId: process.env["TENANT_ID"] || null,
    platformRoutesEnabled: process.env["ENABLE_PLATFORM_ROUTES"] !== "false",
  },

  license: {
    allowMultiTenant: true,
    enforcePlatformAdmin: true,
  },
};

/**
 * Type for platform configuration
 */
export type PlatformConfig = typeof platformConfig;

const initialRuntimeConfig = getRuntimeConfigSnapshot();
if (initialRuntimeConfig) {
  applyPlatformRuntimeConfig(initialRuntimeConfig);
}

export function applyPlatformRuntimeConfig(runtimeConfig: RuntimeConfig | null | undefined): void {
  if (!runtimeConfig) {
    return;
  }

  hydrateApiConfig(runtimeConfig.api);
  hydrateFeatures(runtimeConfig.features);
  hydrateBranding(runtimeConfig.branding);

  if (runtimeConfig.app?.name) {
    platformConfig.app.name = runtimeConfig.app.name;
  }
  if (runtimeConfig.app?.environment) {
    platformConfig.app.environment = runtimeConfig.app.environment;
  }

  if (runtimeConfig.tenant) {
    platformConfig.tenant.id = runtimeConfig.tenant.id ?? platformConfig.tenant.id;
    platformConfig.tenant.slug = runtimeConfig.tenant.slug ?? platformConfig.tenant.slug;
    platformConfig.tenant.name = runtimeConfig.tenant.name ?? platformConfig.tenant.name;
  }

  if (runtimeConfig.realtime) {
    platformConfig.realtime.wsUrl = runtimeConfig.realtime.wsUrl || platformConfig.realtime.wsUrl;
    platformConfig.realtime.sseUrl =
      runtimeConfig.realtime.sseUrl || platformConfig.realtime.sseUrl;
    platformConfig.realtime.alertsChannel =
      runtimeConfig.realtime.alertsChannel || platformConfig.realtime.alertsChannel;
  }

  if (runtimeConfig.deployment) {
    platformConfig.deployment.mode =
      runtimeConfig.deployment.mode || platformConfig.deployment.mode;
    platformConfig.deployment.tenantId =
      runtimeConfig.deployment.tenantId ?? platformConfig.deployment.tenantId;
    platformConfig.deployment.platformRoutesEnabled =
      runtimeConfig.deployment.platformRoutesEnabled ??
      platformConfig.deployment.platformRoutesEnabled;
  }

  if (runtimeConfig.license) {
    platformConfig.license.allowMultiTenant =
      runtimeConfig.license.allowMultiTenant ?? platformConfig.license.allowMultiTenant;
    platformConfig.license.enforcePlatformAdmin =
      runtimeConfig.license.enforcePlatformAdmin ?? platformConfig.license.enforcePlatformAdmin;
  }
}

export default platformConfig;

const IS_ISP_PORTAL = process.env["NEXT_PUBLIC_PORTAL_TYPE"] === "isp";

function hydrateApiConfig(api?: RuntimeConfig["api"]) {
  if (!api) {
    return;
  }

  if (typeof api.baseUrl === "string") {
    apiBaseUrl = sanitizeBaseUrl(api.baseUrl);
    platformConfig.api.baseUrl = apiBaseUrl;
  }

  if (typeof api.restPath === "string") {
    const shouldApplyRestPath = !(
      IS_ISP_PORTAL && api.restPath.startsWith("/api/platform/")
    );
    if (shouldApplyRestPath) {
      apiPrefix = normalizeApiPrefix(api.restPath);
    }
  }

  platformConfig.api.prefix = apiPrefix;
  platformConfig.api.graphqlEndpoint = api.graphqlUrl || buildApiUrl("/graphql");
}

function hydrateFeatures(features?: RuntimeConfig["features"]) {
  if (!features) {
    return;
  }

  Object.entries(features).forEach(([flag, value]) => {
    if (typeof value !== "boolean") {
      return;
    }

    if (flag in platformConfig.features) {
      (platformConfig.features as Record<string, boolean>)[flag] = value;
      return;
    }

    const mapped = FEATURE_FLAG_KEY_MAP[flag];
    if (mapped && mapped in platformConfig.features) {
      (platformConfig.features as Record<string, boolean>)[mapped] = value;
    }
  });
}

function hydrateBranding(branding?: RuntimeConfig["branding"]) {
  if (!branding) {
    return;
  }

  Object.assign(platformConfig.branding, {
    companyName: branding.companyName ?? platformConfig.branding.companyName,
    productName: branding.productName ?? platformConfig.branding.productName,
    productTagline: branding.productTagline ?? platformConfig.branding.productTagline,
    supportEmail: branding.supportEmail ?? platformConfig.branding.supportEmail,
    successEmail: branding.successEmail ?? platformConfig.branding.successEmail,
    partnerSupportEmail:
      branding.partnerSupportEmail ?? platformConfig.branding.partnerSupportEmail,
    // operationsEmail: branding.operationsEmail ?? platformConfig.branding.operationsEmail,
    // notificationDomain: branding.notificationDomain ?? platformConfig.branding.notificationDomain,
  });
}

/**
 * Build branding configuration including theme tokens.
 */
function buildBrandingConfig() {
  const primary = process.env["NEXT_PUBLIC_PRIMARY_COLOR"] || "#0ea5e9";
  const primaryHover = process.env["NEXT_PUBLIC_PRIMARY_HOVER_COLOR"] || shadeColor(primary, -12);
  const primaryForeground = process.env["NEXT_PUBLIC_PRIMARY_FOREGROUND_COLOR"] || "#ffffff";

  const secondary = process.env["NEXT_PUBLIC_SECONDARY_COLOR"] || "#8b5cf6";
  const secondaryHover =
    process.env["NEXT_PUBLIC_SECONDARY_HOVER_COLOR"] || shadeColor(secondary, -12);
  const secondaryForeground = process.env["NEXT_PUBLIC_SECONDARY_FOREGROUND_COLOR"] || "#ffffff";

  const accent = process.env["NEXT_PUBLIC_ACCENT_COLOR"];
  const background = process.env["NEXT_PUBLIC_BACKGROUND_COLOR"];
  const foreground = process.env["NEXT_PUBLIC_FOREGROUND_COLOR"];

  const darkPrimary = process.env["NEXT_PUBLIC_PRIMARY_COLOR_DARK"] || primary;
  const darkPrimaryHover =
    process.env["NEXT_PUBLIC_PRIMARY_HOVER_COLOR_DARK"] || shadeColor(darkPrimary, 8);
  const darkPrimaryForeground =
    process.env["NEXT_PUBLIC_PRIMARY_FOREGROUND_COLOR_DARK"] || "#020617";

  const darkSecondary = process.env["NEXT_PUBLIC_SECONDARY_COLOR_DARK"] || secondary;
  const darkSecondaryHover =
    process.env["NEXT_PUBLIC_SECONDARY_HOVER_COLOR_DARK"] || shadeColor(darkSecondary, 8);
  const darkSecondaryForeground =
    process.env["NEXT_PUBLIC_SECONDARY_FOREGROUND_COLOR_DARK"] || "#020617";

  const darkAccent = process.env["NEXT_PUBLIC_ACCENT_COLOR_DARK"] || accent;
  const darkBackground = process.env["NEXT_PUBLIC_BACKGROUND_COLOR_DARK"] || "#0b1220";
  const darkForeground = process.env["NEXT_PUBLIC_FOREGROUND_COLOR_DARK"] || "#e2e8f0";

  const supportEmail = process.env["NEXT_PUBLIC_SUPPORT_EMAIL"] || "support@example.com";
  const successEmail = process.env["NEXT_PUBLIC_SUCCESS_EMAIL"] || supportEmail;
  const partnerSupportEmail =
    process.env["NEXT_PUBLIC_PARTNER_SUPPORT_EMAIL"] ||
    process.env["NEXT_PUBLIC_PARTNER_EMAIL"] ||
    supportEmail;
  const docsUrl = process.env["NEXT_PUBLIC_DOCS_URL"] || "https://docs.example.com";
  const supportPortalUrl =
    process.env["NEXT_PUBLIC_SUPPORT_PORTAL_URL"] || "/customer-portal/support";
  const statusPageUrl = process.env["NEXT_PUBLIC_STATUS_PAGE_URL"] || "";
  const termsUrl = process.env["NEXT_PUBLIC_TERMS_URL"] || "/customer-portal/terms";
  const privacyUrl = process.env["NEXT_PUBLIC_PRIVACY_URL"] || "/customer-portal/privacy";
  const faviconUrl = process.env["NEXT_PUBLIC_FAVICON"] || "/favicon.ico";

  return {
    companyName: process.env["NEXT_PUBLIC_COMPANY_NAME"] || "DotMac",
    productName: process.env["NEXT_PUBLIC_PRODUCT_NAME"] || "DotMac Platform",
    productTagline: process.env["NEXT_PUBLIC_PRODUCT_TAGLINE"] || "Ready to Deploy",
    logoUrl: process.env["NEXT_PUBLIC_LOGO_URL"] || "/logo.svg",
    logo: {
      light:
        process.env["NEXT_PUBLIC_LOGO_LIGHT"] || process.env["NEXT_PUBLIC_LOGO_URL"] || "/logo.svg",
      dark:
        process.env["NEXT_PUBLIC_LOGO_DARK"] || process.env["NEXT_PUBLIC_LOGO_URL"] || "/logo.svg",
    },
    supportEmail,
    successEmail,
    partnerSupportEmail,
    docsUrl,
    supportPortalUrl,
    statusPageUrl: statusPageUrl || undefined,
    termsUrl,
    privacyUrl,
    faviconUrl,
    colors: {
      primary,
      primaryHover,
      primaryForeground,
      secondary,
      secondaryHover,
      secondaryForeground,
      accent,
      background,
      foreground,
      light: {
        primary,
        primaryHover,
        primaryForeground,
        secondary,
        secondaryHover,
        secondaryForeground,
        accent,
        background,
        foreground,
      },
      dark: {
        primary: darkPrimary,
        primaryHover: darkPrimaryHover,
        primaryForeground: darkPrimaryForeground,
        secondary: darkSecondary,
        secondaryHover: darkSecondaryHover,
        secondaryForeground: darkSecondaryForeground,
        accent: darkAccent,
        background: darkBackground,
        foreground: darkForeground,
      },
    },
    customCss: {
      "--brand-primary": primary,
      "--brand-primary-hover": primaryHover,
      "--brand-primary-foreground": primaryForeground,
      "--brand-secondary": secondary,
      "--brand-secondary-hover": secondaryHover,
      "--brand-secondary-foreground": secondaryForeground,
      "--brand-accent": accent || undefined,
      "--brand-background": background || undefined,
      "--brand-foreground": foreground || undefined,
      "--brand-primary-light": primary,
      "--brand-primary-hover-light": primaryHover,
      "--brand-primary-foreground-light": primaryForeground,
      "--brand-secondary-light": secondary,
      "--brand-secondary-hover-light": secondaryHover,
      "--brand-secondary-foreground-light": secondaryForeground,
      "--brand-accent-light": accent || undefined,
      "--brand-background-light": background || undefined,
      "--brand-foreground-light": foreground || undefined,
      "--brand-primary-dark": darkPrimary,
      "--brand-primary-hover-dark": darkPrimaryHover,
      "--brand-primary-foreground-dark": darkPrimaryForeground,
      "--brand-secondary-dark": darkSecondary,
      "--brand-secondary-hover-dark": darkSecondaryHover,
      "--brand-secondary-foreground-dark": darkSecondaryForeground,
      "--brand-accent-dark": darkAccent || undefined,
      "--brand-background-dark": darkBackground || undefined,
      "--brand-foreground-dark": darkForeground || undefined,
    },
  };
}

/**
 * Utility to shade a hex color by a percentage.
 * Negative percent darkens, positive lightens.
 */
function shadeColor(color: string, percent: number): string {
  if (!color || !color.startsWith("#")) {
    return color;
  }

  let hex = color.slice(1);
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  const num = parseInt(hex, 16);
  const amt = Math.round(2.55 * percent);

  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

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
