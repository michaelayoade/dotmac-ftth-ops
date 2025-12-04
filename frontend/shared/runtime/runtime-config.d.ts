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
declare global {
    var __DOTMAC_RUNTIME_CONFIG__: RuntimeConfig | undefined;
    interface Window {
        __DOTMAC_RUNTIME_CONFIG__?: RuntimeConfig;
    }
}
export declare const isRuntimeConfigDisabled: () => boolean;
export declare function getRuntimeConfigSnapshot(): RuntimeConfig | null;
export declare function setRuntimeConfigSnapshot(config: RuntimeConfig): void;
export declare function loadRuntimeConfig(options?: {
    force?: boolean;
}): Promise<RuntimeConfig>;
export declare function serializeRuntimeConfig(config: RuntimeConfig): string;
//# sourceMappingURL=runtime-config.d.ts.map