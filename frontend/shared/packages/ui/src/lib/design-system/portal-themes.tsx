/**
 * Portal Theme Configuration
 *
 * Defines complete theme configurations for each of the 6 portals
 * Includes colors, typography, spacing, and portal metadata
 */

"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
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
  colors: PortalColorPalette;
  fontSize: (typeof portalFontSizes)[PortalType];
  spacing: (typeof portalSpacing)[PortalType];
  animations: (typeof portalAnimations)[PortalType];
  cssVars: Record<string, string>;
  mode: "light" | "dark";
}

/**
 * Generate CSS custom properties for a portal theme
 */
type PortalColorPalette = {
  primary: (typeof colorTokens)[PortalType]["primary"];
  accent: { DEFAULT: string };
  sidebar: (typeof colorTokens)[PortalType]["sidebar"];
  surface: {
    background: string;
    foreground: string;
    muted: string;
    border: string;
  };
};

const surfacePalette = {
  light: {
    background: "hsl(210 40% 98%)",
    foreground: "hsl(222.2 47.4% 11.2%)",
    muted: "hsl(210 16% 93%)",
    border: "hsl(214.3 31.8% 91.4%)",
  },
  dark: {
    background: "hsl(222.2 84% 4.9%)",
    foreground: "hsl(210 40% 98%)",
    muted: "hsl(217.2 32.6% 17.5%)",
    border: "hsl(217.2 32.6% 20%)",
  },
} as const;

const DARK_LIGHTNESS_SHIFT = 8;

function adjustHslLightness(color: string, delta: number): string {
  const match = color.match(/hsl\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%\s*\)/i);
  if (!match) {
    return color;
  }

  const [, hue, saturation, lightness] = match;
  if (!lightness) {
    return color;
  }
  const nextLightness = Math.min(100, Math.max(0, parseFloat(lightness) + delta));

  return `hsl(${hue} ${saturation}% ${nextLightness}%)`;
}

function deriveDarkScale(
  scale: (typeof colorTokens)[PortalType]["primary"],
): (typeof colorTokens)[PortalType]["primary"] {
  return Object.entries(scale).reduce(
    (acc, [shade, value]) => ({
      ...acc,
      [shade]: adjustHslLightness(value, DARK_LIGHTNESS_SHIFT),
    }),
    scale,
  ) as (typeof colorTokens)[PortalType]["primary"];
}

function getPortalPalette(portal: PortalType, mode: "light" | "dark"): PortalColorPalette {
  const base = colorTokens[portal];
  const primary =
    mode === "dark"
      ? deriveDarkScale(base.primary)
      : (base.primary as PortalColorPalette["primary"]);
  const accent =
    mode === "dark"
      ? adjustHslLightness(base.accent.DEFAULT, DARK_LIGHTNESS_SHIFT / 2)
      : base.accent.DEFAULT;

  return {
    primary,
    accent: { DEFAULT: accent },
    sidebar: base.sidebar,
    surface: surfacePalette[mode],
  };
}

function generateCSSVars(palette: PortalColorPalette): Record<string, string> {
  const colors = palette;

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
    "--portal-surface": colors.surface.background,
    "--portal-surface-foreground": colors.surface.foreground,
    "--portal-surface-muted": colors.surface.muted,
    "--portal-surface-border": colors.surface.border,

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
  const { resolvedTheme } = useTheme();
  const [currentPortal, setCurrentPortal] = useState<PortalType>(() =>
    detectPortalFromRoute(pathname || ""),
  );
  const colorMode: "light" | "dark" = resolvedTheme === "dark" ? "dark" : "light";
  const palette = useMemo(
    () => getPortalPalette(currentPortal, colorMode),
    [colorMode, currentPortal],
  );

  // Auto-detect portal from route changes
  useEffect(() => {
    const detectedPortal = detectPortalFromRoute(pathname || "");
    setCurrentPortal(detectedPortal);
  }, [pathname]);

  // Apply CSS variables to document root
  useEffect(() => {
    const cssVars = generateCSSVars(palette);
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
  }, [currentPortal, palette]);

  const theme: PortalTheme = useMemo(
    () => ({
      portal: currentPortal,
      metadata: portalMetadata[currentPortal],
      colors: palette,
      fontSize: portalFontSizes[currentPortal],
      spacing: portalSpacing[currentPortal],
      animations: portalAnimations[currentPortal],
      cssVars: generateCSSVars(palette),
      mode: colorMode,
    }),
    [colorMode, currentPortal, palette],
  );

  const contextValue = useMemo(
    () => ({
      currentPortal,
      theme,
      setPortal: setCurrentPortal,
    }),
    [currentPortal, theme],
  );

  return <PortalThemeContext.Provider value={contextValue}>{children}</PortalThemeContext.Provider>;
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
