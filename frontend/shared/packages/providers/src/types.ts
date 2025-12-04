export type PortalType =
  | "customer"
  | "admin"
  | "reseller"
  | "technician"
  | "management-admin"
  | "management-reseller"
  | "tenant-portal";

export interface FeatureFlags {
  notifications?: boolean;
  realtime?: boolean;
  analytics?: boolean;
  tenantManagement?: boolean;
  errorHandling?: boolean;
  performanceMonitoring?: boolean;
}

export interface QueryConfig {
  staleTime?: number;
  cacheTime?: number;
  retry?: boolean | number | ((failureCount: number, error: unknown) => boolean);
  retryDelay?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
}

export interface NotificationConfig {
  maxNotifications?: number;
  defaultDuration?: number;
  position?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center";
  enableSound?: boolean;
}

export interface ThemeConfig {
  mode?: "light" | "dark" | "auto";
  primaryColor?: string;
  accentColor?: string;
  borderRadius?: string;
  fontSize?: "small" | "medium" | "large";
}

export interface ProviderConfig {
  queryOptions?: QueryConfig;
  notificationOptions?: NotificationConfig;
  themeOptions?: ThemeConfig;
  enableDevtools?: boolean;
  enableStrictMode?: boolean;
}

export interface UniversalProvidersProps {
  children: React.ReactNode;
  portal: PortalType;
  features?: FeatureFlags;
  config?: ProviderConfig;
  customProviders?: React.ComponentType<{ children: React.ReactNode }>[];
}
