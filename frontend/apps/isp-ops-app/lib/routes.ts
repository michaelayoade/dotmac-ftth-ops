/**
 * Application Route Constants
 *
 * Centralized route definitions for type-safe navigation.
 * Use these constants instead of hardcoded strings throughout the app.
 *
 * @example
 * ```ts
 * import { ROUTES } from '@/lib/routes';
 * import { useRouter } from 'next/navigation';
 *
 * const router = useRouter();
 * router.push(ROUTES.LOGIN);
 * router.push(ROUTES.DASHBOARD.CUSTOMERS);
 * ```
 */

export const ROUTES = {
  // Public routes
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",

  // Multi-Factor Authentication
  MFA: {
    SETUP: "/mfa/setup",
    VERIFY: "/mfa/verify",
  },

  // Dashboard routes (Admin/ISP Operations)
  DASHBOARD: {
    HOME: "/dashboard",
    ANALYTICS: "/dashboard/analytics",
    BILLING: "/dashboard/billing",
    CUSTOMERS: "/dashboard/customers",
    NETWORK_MONITORING: "/dashboard/network-monitoring",
    INFRASTRUCTURE: "/dashboard/infrastructure",
    PROVISIONING: "/dashboard/provisioning",
    RADIUS: "/dashboard/radius",
    GENIEACS: "/dashboard/genieacs",
    VOLTHA: "/dashboard/voltha",
    WIRELESS: "/dashboard/wireless",
    FIBER: "/dashboard/fiber",
    PLATFORM_ADMIN: "/dashboard/platform-admin",
    SETTINGS: "/dashboard/settings",
    USERS: "/dashboard/users",
    ROLES: "/dashboard/roles",
    WEBHOOKS: "/dashboard/webhooks",
    INTEGRATIONS: "/dashboard/integrations",
    JOBS: "/dashboard/jobs",
    LICENSES: "/dashboard/licenses",
  },

  // Tenant routes (Multi-tenant operations)
  TENANT: {
    HOME: "/tenant",
    CUSTOMERS: "/tenant/customers",
    BILLING: "/tenant/billing",
    SERVICES: "/tenant/services",
    NETWORK_MONITORING: "/tenant/network-monitoring",
    AUTOMATION: "/tenant/automation",
    INFRASTRUCTURE: "/tenant/infrastructure",
    ANALYTICS: "/tenant/analytics",
    REPORTS: "/tenant/reports",
    SETTINGS: "/tenant/settings",
    USERS: "/tenant/users",
    INTEGRATIONS: "/tenant/integrations",
    WEBHOOKS: "/tenant/webhooks",
    JOBS: "/tenant/jobs",
    RADIUS: "/tenant/radius",
    GENIEACS: "/tenant/genieacs",
  },

  // Partner portal routes
  PARTNER: {
    HOME: "/partner",
    DASHBOARD: "/partner/dashboard",
    CUSTOMERS: "/partner/customers",
    REVENUE: "/partner/revenue",
    ANALYTICS: "/partner/analytics",
    SETTINGS: "/partner/settings",
  },

  // Customer portal routes
  CUSTOMER_PORTAL: {
    HOME: "/customer-portal",
    DASHBOARD: "/customer-portal/dashboard",
    BILLING: "/customer-portal/billing",
    SERVICES: "/customer-portal/services",
    SUPPORT: "/customer-portal/support",
    PROFILE: "/customer-portal/profile",
  },

  // Commission portal routes
  PORTAL: {
    HOME: "/portal",
    DASHBOARD: "/portal/dashboard",
    COMMISSIONS: "/portal/commissions",
  },

  // Admin routes (Platform administration)
  ADMIN: {
    HOME: "/admin",
    TENANTS: "/admin/tenants",
    USERS: "/admin/users",
    SETTINGS: "/admin/settings",
    MONITORING: "/admin/monitoring",
  },
} as const;

/**
 * API route constants
 */
export const API_ROUTES = {
  BASE: "/api/isp/v1/admin",
  AUTH: {
    LOGIN: "/api/isp/v1/admin/auth/login",
    LOGOUT: "/api/isp/v1/admin/auth/logout",
    REGISTER: "/api/isp/v1/admin/auth/register",
    REFRESH: "/api/isp/v1/admin/auth/refresh",
    ME: "/api/isp/v1/admin/auth/me",
  },
  CUSTOMERS: "/api/isp/v1/admin/customers",
  BILLING: "/api/isp/v1/admin/billing",
  NETWORK: "/api/isp/v1/admin/network",
  RADIUS: "/api/isp/v1/admin/radius",
  GENIEACS: "/api/isp/v1/admin/genieacs",
  VOLTHA: "/api/isp/v1/admin/access",
  ACCESS: "/api/isp/v1/admin/access",
  WEBHOOKS: "/api/isp/v1/admin/webhooks",
  INTEGRATIONS: "/api/isp/v1/admin/integrations",
  JOBS: "/api/isp/v1/admin/jobs",
  HEALTH: "/api/isp/v1/admin/health",
  READY: "/api/isp/v1/admin/ready",
} as const;

/**
 * Helper function to check if a path matches a route
 */
export const isRoute = (path: string, route: string): boolean => {
  return path === route || path.startsWith(`${route}/`);
};

/**
 * Helper function to check if current path is in dashboard
 */
export const isDashboardRoute = (path: string): boolean => {
  return isRoute(path, ROUTES.DASHBOARD.HOME);
};

/**
 * Helper function to check if current path is in tenant area
 */
export const isTenantRoute = (path: string): boolean => {
  return isRoute(path, ROUTES.TENANT.HOME);
};

/**
 * Helper function to check if current path requires authentication
 */
export const isProtectedRoute = (path: string): boolean => {
  const publicRoutes: string[] = [
    ROUTES.HOME,
    ROUTES.LOGIN,
    ROUTES.REGISTER,
    ROUTES.FORGOT_PASSWORD,
    ROUTES.RESET_PASSWORD,
  ];

  return !publicRoutes.includes(path);
};

/**
 * Type-safe route builder with parameters
 */
export const buildRoute = {
  customer: (id: string) => `${ROUTES.DASHBOARD.CUSTOMERS}/${id}`,
  tenant: (id: string) => `${ROUTES.ADMIN.TENANTS}/${id}`,
  job: (id: string) => `${ROUTES.DASHBOARD.JOBS}/${id}`,
  webhook: (id: string) => `${ROUTES.DASHBOARD.WEBHOOKS}/${id}`,
} as const;
