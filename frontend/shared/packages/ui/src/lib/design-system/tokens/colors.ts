/**
 * Design System - Color Tokens
 *
 * Portal-specific color schemes for visual differentiation
 * Each portal has a unique primary color to help users identify where they are
 */

export const colorTokens = {
  /**
   * Portal 1: Platform Admin
   * Deep Blue - Authority, Trust, Technical Excellence
   */
  platformAdmin: {
    primary: {
      50: "hsl(217, 91%, 95%)",
      100: "hsl(217, 91%, 90%)",
      200: "hsl(217, 91%, 80%)",
      300: "hsl(217, 91%, 70%)",
      400: "hsl(217, 91%, 60%)", // Main
      500: "hsl(217, 91%, 50%)",
      600: "hsl(217, 91%, 40%)",
      700: "hsl(217, 91%, 30%)",
      800: "hsl(217, 91%, 20%)",
      900: "hsl(217, 91%, 10%)",
    },
    accent: {
      DEFAULT: "hsl(189, 85%, 47%)", // Cyan - Technical, Monitoring
    },
    sidebar: "dark", // Enforced dark sidebar
  },

  /**
   * Portal 2: Platform Resellers (Partners)
   * Orange - Energy, Sales, Action-Oriented
   */
  platformResellers: {
    primary: {
      50: "hsl(24, 95%, 95%)",
      100: "hsl(24, 95%, 90%)",
      200: "hsl(24, 95%, 80%)",
      300: "hsl(24, 95%, 70%)",
      400: "hsl(24, 95%, 60%)",
      500: "hsl(24, 95%, 53%)", // Main
      600: "hsl(24, 95%, 43%)",
      700: "hsl(24, 95%, 33%)",
      800: "hsl(24, 95%, 23%)",
      900: "hsl(24, 95%, 13%)",
    },
    accent: {
      DEFAULT: "hsl(142, 71%, 45%)", // Green - Money, Growth
    },
    sidebar: "light", // Light sidebar default
  },

  /**
   * Portal 3: Platform Tenants (ISPs)
   * Purple - Premium, Business, Professional
   */
  platformTenants: {
    primary: {
      50: "hsl(262, 83%, 95%)",
      100: "hsl(262, 83%, 90%)",
      200: "hsl(262, 83%, 80%)",
      300: "hsl(262, 83%, 70%)",
      400: "hsl(262, 83%, 60%)",
      500: "hsl(262, 83%, 58%)", // Main
      600: "hsl(262, 83%, 48%)",
      700: "hsl(262, 83%, 38%)",
      800: "hsl(262, 83%, 28%)",
      900: "hsl(262, 83%, 18%)",
    },
    accent: {
      DEFAULT: "hsl(217, 91%, 60%)", // Blue - Trust
    },
    sidebar: "light", // Light sidebar default
  },

  /**
   * Portal 4: ISP Admin
   * Blue - Professional, Operations, Reliable
   */
  ispAdmin: {
    primary: {
      50: "hsl(207, 90%, 95%)",
      100: "hsl(207, 90%, 90%)",
      200: "hsl(207, 90%, 80%)",
      300: "hsl(207, 90%, 70%)",
      400: "hsl(207, 90%, 60%)",
      500: "hsl(207, 90%, 54%)", // Main
      600: "hsl(207, 90%, 44%)",
      700: "hsl(207, 90%, 34%)",
      800: "hsl(207, 90%, 24%)",
      900: "hsl(207, 90%, 14%)",
    },
    accent: {
      DEFAULT: "hsl(142, 71%, 45%)", // Green - Operational Health
    },
    sidebar: "dark", // Dark sidebar preferred (long hours)
  },

  /**
   * Portal 5: ISP Reseller
   * Green - Money, Success, Growth
   */
  ispReseller: {
    primary: {
      50: "hsl(142, 71%, 95%)",
      100: "hsl(142, 71%, 90%)",
      200: "hsl(142, 71%, 80%)",
      300: "hsl(142, 71%, 70%)",
      400: "hsl(142, 71%, 60%)",
      500: "hsl(142, 71%, 45%)", // Main
      600: "hsl(142, 71%, 35%)",
      700: "hsl(142, 71%, 25%)",
      800: "hsl(142, 71%, 15%)",
      900: "hsl(142, 71%, 10%)",
    },
    accent: {
      DEFAULT: "hsl(24, 95%, 53%)", // Orange - Energy, Action
    },
    sidebar: "none", // Bottom nav on mobile
  },

  /**
   * Portal 6: ISP Customer
   * Friendly Blue - Approachable, Trustworthy, Simple
   */
  ispCustomer: {
    primary: {
      50: "hsl(207, 90%, 95%)",
      100: "hsl(207, 90%, 90%)",
      200: "hsl(207, 90%, 80%)",
      300: "hsl(207, 90%, 70%)",
      400: "hsl(207, 90%, 60%)",
      500: "hsl(207, 90%, 54%)", // Main
      600: "hsl(207, 90%, 44%)",
      700: "hsl(207, 90%, 34%)",
      800: "hsl(207, 90%, 24%)",
      900: "hsl(207, 90%, 14%)",
    },
    accent: {
      DEFAULT: "hsl(142, 71%, 45%)", // Green - Service Active
    },
    sidebar: "none", // Top nav on mobile
  },

  /**
   * Semantic Colors (Shared across all portals)
   */
  semantic: {
    success: "hsl(142, 71%, 45%)", // Green
    warning: "hsl(45, 93%, 47%)", // Amber
    error: "hsl(0, 84%, 60%)", // Red
    info: "hsl(207, 90%, 54%)", // Blue
  },

  /**
   * Status Colors (Network/Service Status)
   */
  status: {
    online: "hsl(142, 71%, 45%)", // Green
    offline: "hsl(0, 84%, 60%)", // Red
    degraded: "hsl(45, 93%, 47%)", // Amber
    unknown: "hsl(220, 9%, 46%)", // Gray
  },
} as const;

/**
 * Portal Type Definition
 */
export type PortalType =
  | "platformAdmin"
  | "platformResellers"
  | "platformTenants"
  | "ispAdmin"
  | "ispReseller"
  | "ispCustomer";

/**
 * Get color palette for a specific portal
 */
export function getPortalColors(portal: PortalType) {
  return colorTokens[portal];
}

/**
 * Portal route prefixes for automatic detection
 */
export const portalRoutes: Record<PortalType, string> = {
  platformAdmin: "/dashboard/platform-admin",
  platformResellers: "/partner",
  platformTenants: "/tenant",
  ispAdmin: "/dashboard",
  ispReseller: "/portal",
  ispCustomer: "/customer-portal",
};

/**
 * Detect portal type from current route
 */
export function detectPortalFromRoute(pathname: string): PortalType {
  // Order matters - check most specific routes first
  if (pathname.startsWith("/dashboard/platform-admin")) return "platformAdmin";
  if (pathname.startsWith("/customer-portal")) return "ispCustomer";
  if (pathname.startsWith("/partner")) return "platformResellers";
  if (pathname.startsWith("/tenant")) return "platformTenants";
  if (pathname.startsWith("/portal")) return "ispReseller";
  if (pathname.startsWith("/dashboard")) return "ispAdmin";

  // Default to ISP Admin for unknown routes
  return "ispAdmin";
}
