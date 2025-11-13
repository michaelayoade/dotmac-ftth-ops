/**
 * Portal Theme Configuration
 *
 * Defines complete theme configurations for each of the 6 portals
 * Includes colors, typography, spacing, and portal metadata
 */

"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { portalAnimations } from "./tokens/animations";
import { colorTokens, detectPortalFromRoute, type PortalType } from "./tokens/colors";
import { portalSpacing } from "./tokens/spacing";
import { portalFontSizes } from "./tokens/typography";

/**
 * Portal metadata for display
 */
export const portalMetadata = {
  platformAdmin: {
    name: "Platform Administration",
    shortName: "Platform Admin",
    description: "Manage the entire multi-tenant platform",
    icon: "🏢",
    userType: "DotMac Staff",
  },
  platformResellers: {
    name: "Partner Portal",
    shortName: "Partners",
    description: "Channel partner management and commissions",
    icon: "🤝",
    userType: "Channel Partner",
  },
  platformTenants: {
    name: "Tenant Portal",
    shortName: "Tenant",
    description: "Manage your ISP business relationship",
    icon: "🏬",
    userType: "ISP Owner",
  },
  ispAdmin: {
    name: "ISP Operations",
    shortName: "ISP Admin",
    description: "Full ISP operations and network management",
    icon: "📡",
    userType: "ISP Staff",
  },
  ispReseller: {
    name: "Sales Portal",
    shortName: "Sales",
    description: "Generate referrals and track commissions",
    icon: "💰",
    userType: "Sales Agent",
  },
  ispCustomer: {
    name: "Customer Portal",
    shortName: "My Account",
    description: "Manage your internet service",
    icon: "🏠",
    userType: "Customer",
  },
} as const;

/**
 * Complete portal theme configuration
 */
export interface PortalTheme {
  portal: PortalType;
  metadata: (typeof portalMetadata)[PortalType];
  colors: (typeof colorTokens)[PortalType];
  fontSize: (typeof portalFontSizes)[PortalType];
  spacing: (typeof portalSpacing)[PortalType];
  animations: (typeof portalAnimations)[PortalType];
  cssVars: Record<string, string>;
}

/**
 * Generate CSS custom properties for a portal theme
 */
function generateCSSVars(portal: PortalType): Record<string, string> {
  const colors = colorTokens[portal];

  return {
    // Primary color scale
    "--portal-primary-50": colors.primary[50],
    "--portal-primary-100": colors.primary[100],
    "--portal-primary-200": colors.primary[200],
    "--portal-primary-300": colors.primary[300],
    "--portal-primary-400": colors.primary[400],
    "--portal-primary-500": colors.primary[500],
    "--portal-primary-600": colors.primary[600],
    "--portal-primary-700": colors.primary[700],
    "--portal-primary-800": colors.primary[800],
    "--portal-primary-900": colors.primary[900],

    // Accent color
    "--portal-accent": colors.accent.DEFAULT,

    // Semantic colors (shared)
    "--portal-success": colorTokens.semantic.success,
    "--portal-warning": colorTokens.semantic.warning,
    "--portal-error": colorTokens.semantic.error,
    "--portal-info": colorTokens.semantic.info,

    // Status colors (shared)
    "--portal-status-online": colorTokens.status.online,
    "--portal-status-offline": colorTokens.status.offline,
    "--portal-status-degraded": colorTokens.status.degraded,
    "--portal-status-unknown": colorTokens.status.unknown,
  };
}

/**
 * Portal Theme Context
 */
export interface PortalThemeContextValue {
  currentPortal: PortalType;
  theme: PortalTheme;
  setPortal: (portal: PortalType) => void;
}

const PortalThemeContext = createContext<PortalThemeContextValue | null>(null);

/**
 * Portal Theme Provider
 * Automatically detects and applies the correct theme based on the current route
 */
export function PortalThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [currentPortal, setCurrentPortal] = useState<PortalType>(() =>
    detectPortalFromRoute(pathname || ""),
  );

  // Auto-detect portal from route changes
  useEffect(() => {
    const detectedPortal = detectPortalFromRoute(pathname || "");
    setCurrentPortal(detectedPortal);
  }, [pathname]);

  // Apply CSS variables to document root
  useEffect(() => {
    const cssVars = generateCSSVars(currentPortal);
    const root = document.documentElement;

    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Also set a data attribute for portal-specific CSS
    root.setAttribute("data-portal", currentPortal);

    return () => {
      // Cleanup on unmount
      Object.keys(cssVars).forEach((key) => {
        root.style.removeProperty(key);
      });
      root.removeAttribute("data-portal");
    };
  }, [currentPortal]);

  const theme: PortalTheme = useMemo(
    () => ({
      portal: currentPortal,
      metadata: portalMetadata[currentPortal],
      colors: colorTokens[currentPortal],
      fontSize: portalFontSizes[currentPortal],
      spacing: portalSpacing[currentPortal],
      animations: portalAnimations[currentPortal],
      cssVars: generateCSSVars(currentPortal),
    }),
    [currentPortal],
  );

  const contextValue = useMemo(
    () => ({
      currentPortal,
      theme,
      setPortal: setCurrentPortal,
    }),
    [currentPortal, theme],
  );

  return (
    <PortalThemeContext.Provider value={contextValue}>
      {children}
    </PortalThemeContext.Provider>
  );
}

/**
 * Hook to access current portal theme
 */
export function usePortalTheme() {
  const context = useContext(PortalThemeContext);

  if (!context) {
    throw new Error("usePortalTheme must be used within PortalThemeProvider");
  }

  return context;
}

/**
 * Hook to get portal-specific CSS class
 */
export function usePortalClass(baseClass: string = "") {
  const { currentPortal } = usePortalTheme();
  return `${baseClass} portal-${currentPortal}`.trim();
}
