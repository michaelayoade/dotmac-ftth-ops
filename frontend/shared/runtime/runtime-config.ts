export type RuntimeTenantConfig = {
  id: string | null;
  slug: string | null;
  name: string;
};

export type RuntimeApiConfig = {
  baseUrl: string;
  restPath: string;
  restUrl: string;
  graphqlUrl: string;
  websocketUrl: string;
};

export type RuntimeRealtimeConfig = {
  wsUrl: string;
  sseUrl: string;
  alertsChannel: string;
};

export type RuntimeDeploymentConfig = {
  mode: string;
  tenantId: string | null;
  platformRoutesEnabled: boolean;
};

export type RuntimeLicenseConfig = {
  allowMultiTenant: boolean;
  enforcePlatformAdmin: boolean;
};

export type RuntimeBrandingConfig = {
  companyName: string;
  productName: string;
  productTagline: string;
  supportEmail?: string;
  successEmail?: string;
  operationsEmail?: string;
  partnerSupportEmail?: string;
  notificationDomain?: string;
};

export type RuntimeFeatureFlags = Record<string, boolean>;

export type RuntimeConfig = {
  version: string;
  generatedAt: string;
  cacheTtlSeconds: number;
  tenant: RuntimeTenantConfig;
  api: RuntimeApiConfig;
  realtime: RuntimeRealtimeConfig;
  deployment: RuntimeDeploymentConfig;
  license: RuntimeLicenseConfig;
  branding: RuntimeBrandingConfig;
  features: RuntimeFeatureFlags;
  app: {
    name: string;
    environment: string;
  };
};

type BackendRuntimeConfig = {
  version: string;
  generated_at: string;
  cache_ttl_seconds?: number;
  tenant: {
    id: string | null;
    slug: string | null;
    name: string;
  };
  api: {
    base_url?: string | null;
    rest_path?: string | null;
    rest_url?: string | null;
    graphql_url?: string | null;
    websocket_url?: string | null;
  };
  realtime?: {
    ws_url?: string | null;
    sse_url?: string | null;
    alerts_channel?: string | null;
  };
  deployment?: {
    mode?: string;
    tenant_id?: string | null;
    platform_routes_enabled?: boolean;
  };
  license?: {
    allow_multi_tenant?: boolean;
    enforce_platform_admin?: boolean;
  };
  branding: RuntimeBrandingConfig;
  features: RuntimeFeatureFlags;
  app: {
    name: string;
    environment: string;
  };
};

declare global {
  // eslint-disable-next-line no-var, @typescript-eslint/naming-convention
  var __DOTMAC_RUNTIME_CONFIG__: RuntimeConfig | undefined;
  interface Window {
    __DOTMAC_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

const runtimeConfigDisabled = process.env["NEXT_PUBLIC_RUNTIME_CONFIG_DISABLED"] === "true";

export const isRuntimeConfigDisabled = () => runtimeConfigDisabled;

let runtimeConfigCache: RuntimeConfig | null = null;
let pendingRequest: Promise<RuntimeConfig> | null = null;

export function getRuntimeConfigSnapshot(): RuntimeConfig | null {
  if (runtimeConfigCache) {
    return runtimeConfigCache;
  }

  if (typeof window !== "undefined" && window.__DOTMAC_RUNTIME_CONFIG__) {
    runtimeConfigCache = window.__DOTMAC_RUNTIME_CONFIG__;
    return runtimeConfigCache;
  }

  if (typeof globalThis !== "undefined" && globalThis.__DOTMAC_RUNTIME_CONFIG__) {
    runtimeConfigCache = globalThis.__DOTMAC_RUNTIME_CONFIG__;
    return runtimeConfigCache;
  }

  return null;
}

export function setRuntimeConfigSnapshot(config: RuntimeConfig): void {
  runtimeConfigCache = config;
  if (typeof window !== "undefined") {
    window.__DOTMAC_RUNTIME_CONFIG__ = config;
  } else {
    globalThis.__DOTMAC_RUNTIME_CONFIG__ = config;
  }
}

export async function loadRuntimeConfig(options?: { force?: boolean }): Promise<RuntimeConfig> {
  if (runtimeConfigDisabled) {
    return Promise.reject(new Error("Runtime config loading is disabled"));
  }

  if (options?.force) {
    runtimeConfigCache = null;
    pendingRequest = null;
  }

  if (runtimeConfigCache && !options?.force) {
    return runtimeConfigCache;
  }

  if (!pendingRequest) {
    pendingRequest = fetchRuntimeConfigFromApi()
      .then((payload) => {
        runtimeConfigCache = payload;
        globalThis.__DOTMAC_RUNTIME_CONFIG__ = payload;
        return payload;
      })
      .finally(() => {
        pendingRequest = null;
      });
  }

  return pendingRequest;
}

export function serializeRuntimeConfig(config: RuntimeConfig): string {
  return JSON.stringify(config).replace(/</g, "\\u003c");
}

async function fetchRuntimeConfigFromApi(): Promise<RuntimeConfig> {
  const response = await fetch("/api/v1/platform/runtime-config", {
    cache: "no-store",
    next: {
      revalidate: 60,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load runtime config (${response.status})`);
  }

  const payload = (await response.json()) as BackendRuntimeConfig;
  return normalizeRuntimePayload(payload);
}

function normalizeRuntimePayload(payload: BackendRuntimeConfig): RuntimeConfig {
  const restPath = payload.api.rest_path || "/api/v1";
  const baseUrl = sanitizeBaseUrl(payload.api.base_url);
  const restUrl = payload.api.rest_url || joinUrl(baseUrl, restPath);
  const realtimeSource = payload.realtime ?? {};

  return {
    version: payload.version,
    generatedAt: payload.generated_at,
    cacheTtlSeconds: payload.cache_ttl_seconds ?? 60,
    tenant: {
      id: payload.tenant.id,
      slug: payload.tenant.slug,
      name: payload.tenant.name,
    },
    api: {
      baseUrl,
      restPath,
      restUrl,
      graphqlUrl: payload.api.graphql_url || joinUrl(restUrl, "/graphql"),
      websocketUrl: payload.api.websocket_url || joinUrl(restUrl, "/realtime/ws"),
    },
    realtime: {
      wsUrl: realtimeSource.ws_url || payload.api.websocket_url || joinUrl(baseUrl, "/realtime/ws"),
      sseUrl: realtimeSource.sse_url || joinUrl(restUrl, "/realtime/events"),
      alertsChannel: realtimeSource.alerts_channel || `tenant-${payload.tenant.slug ?? "global"}`,
    },
    deployment: {
      mode: payload.deployment?.mode || "multi_tenant",
      tenantId: payload.deployment?.tenant_id ?? payload.tenant.id,
      platformRoutesEnabled: payload.deployment?.platform_routes_enabled ?? true,
    },
    license: {
      allowMultiTenant: payload.license?.allow_multi_tenant ?? true,
      enforcePlatformAdmin: payload.license?.enforce_platform_admin ?? true,
    },
    branding: payload.branding,
    features: payload.features,
    app: payload.app,
  };
}

function sanitizeBaseUrl(value?: string | null): string {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/\/+$/, "");
}

function joinUrl(base: string, path: string): string {
  if (!base) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`.replace(/(?<!:)\/{2,}/g, "/");
}
