/**
 * Dynamic Theme Provider for ISP Framework
 * Supports white-labeling, multi-tenant theming, and brand customization
 *
 * ELIMINATES HARDCODED THEMES: Dynamic theme injection from configuration
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

// Theme configuration interface for white-labeling
export interface BrandTheme {
  id: string;
  name: string;
  colors: {
    primary: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
      950: string;
    };
    secondary: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
      950: string;
    };
    accent?: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
      950: string;
    };
    neutral: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
      950: string;
    };
    success: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
      950: string;
    };
    warning: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
      950: string;
    };
    error: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
      950: string;
    };
  };
  typography: {
    fontFamily: {
      sans: string[];
      serif: string[];
      mono: string[];
    };
    fontSize: {
      xs: [string, { lineHeight: string; letterSpacing: string }];
      sm: [string, { lineHeight: string; letterSpacing: string }];
      base: [string, { lineHeight: string; letterSpacing: string }];
      lg: [string, { lineHeight: string; letterSpacing: string }];
      xl: [string, { lineHeight: string; letterSpacing: string }];
      "2xl": [string, { lineHeight: string; letterSpacing: string }];
      "3xl": [string, { lineHeight: string; letterSpacing: string }];
      "4xl": [string, { lineHeight: string; letterSpacing: string }];
    };
    fontWeight: {
      light: string;
      normal: string;
      medium: string;
      semibold: string;
      bold: string;
      extrabold: string;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
    "4xl": string;
  };
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    "2xl": string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    "2xl": string;
  };
  // Brand-specific customizations
  brand: {
    logo?: {
      light: string;
      dark: string;
    };
    favicon?: string;
    name: string;
    tagline?: string;
    customCss?: string;
  };
  // Portal-specific overrides
  portals?: {
    [portalType: string]: Partial<BrandTheme>;
  };
}

// Portal variants for ISP framework
export type PortalVariant =
  | "admin"
  | "customer"
  | "reseller"
  | "technician"
  | "management"
  | "whitelabel";

// Theme context
interface ThemeContextType {
  currentTheme: BrandTheme;
  portalVariant: PortalVariant;
  setTheme: (theme: BrandTheme) => void;
  setPortalVariant: (variant: PortalVariant) => void;
  getPortalTheme: () => BrandTheme;
  getCSSVariables: () => Record<string, string>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Default base theme (fallback only)
const defaultTheme: BrandTheme = {
  id: "default",
  name: "Default ISP Theme",
  colors: {
    primary: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
      950: "#172554",
    },
    secondary: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
      950: "#020617",
    },
    neutral: {
      50: "#fafafa",
      100: "#f5f5f5",
      200: "#e5e5e5",
      300: "#d4d4d4",
      400: "#a3a3a3",
      500: "#737373",
      600: "#525252",
      700: "#404040",
      800: "#262626",
      900: "#171717",
      950: "#0a0a0a",
    },
    success: {
      50: "#f0fdf4",
      100: "#dcfce7",
      200: "#bbf7d0",
      300: "#86efac",
      400: "#4ade80",
      500: "#22c55e",
      600: "#16a34a",
      700: "#15803d",
      800: "#166534",
      900: "#14532d",
      950: "#052e16",
    },
    warning: {
      50: "#fefce8",
      100: "#fef3c7",
      200: "#fde68a",
      300: "#fcd34d",
      400: "#fbbf24",
      500: "#f59e0b",
      600: "#d97706",
      700: "#b45309",
      800: "#92400e",
      900: "#78350f",
      950: "#451a03",
    },
    error: {
      50: "#fef2f2",
      100: "#fee2e2",
      200: "#fecaca",
      300: "#fca5a5",
      400: "#f87171",
      500: "#ef4444",
      600: "#dc2626",
      700: "#b91c1c",
      800: "#991b1b",
      900: "#7f1d1d",
      950: "#450a0a",
    },
  },
  typography: {
    fontFamily: {
      sans: ["Inter", "system-ui", "sans-serif"],
      serif: ["Georgia", "serif"],
      mono: ["JetBrains Mono", "monospace"],
    },
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.05em" }],
      sm: ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "0.025em" }],
      base: ["1rem", { lineHeight: "1.5rem", letterSpacing: "0em" }],
      lg: ["1.125rem", { lineHeight: "1.75rem", letterSpacing: "-0.025em" }],
      xl: ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.025em" }],
      "2xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.05em" }],
      "3xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.05em" }],
      "4xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.05em" }],
    },
    fontWeight: {
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
    },
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
    "3xl": "4rem",
    "4xl": "6rem",
  },
  borderRadius: {
    none: "0px",
    sm: "0.125rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    full: "9999px",
  },
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  },
  brand: {
    name: "DotMac ISP Framework",
    tagline: "Enterprise ISP Management Platform",
  },
};

interface ThemeProviderProps {
  children: ReactNode;
  theme?: BrandTheme;
  portalVariant?: PortalVariant;
  configEndpoint?: string; // For loading theme from API
  tenantId?: string; // For multi-tenant theming
}

export function ThemeProvider({
  children,
  theme: initialTheme,
  portalVariant = "admin",
  configEndpoint,
  tenantId,
}: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<BrandTheme>(initialTheme || defaultTheme);
  const [portalVar, setPortalVar] = useState<PortalVariant>(portalVariant);

  // Load theme from configuration endpoint
  useEffect(() => {
    const loadThemeConfig = async () => {
      if (!configEndpoint) return;

      try {
        const url = tenantId
          ? `${configEndpoint}?tenant=${tenantId}&portal=${portalVar}`
          : `${configEndpoint}?portal=${portalVar}`;

        const response = await fetch(url);
        const themeConfig = await response.json();

        if (themeConfig.success && themeConfig.theme) {
          setCurrentTheme(themeConfig.theme);
        }
      } catch (error) {
        console.warn("Failed to load theme configuration, using default:", error);
      }
    };

    loadThemeConfig();
  }, [configEndpoint, tenantId, portalVar]);

  // Get portal-specific theme with overrides
  const getPortalTheme = (): BrandTheme => {
    if (!currentTheme.portals?.[portalVar]) {
      return currentTheme;
    }

    // Deep merge portal overrides
    return {
      ...currentTheme,
      colors: {
        ...currentTheme.colors,
        ...currentTheme.portals[portalVar]?.colors,
      },
      typography: {
        ...currentTheme.typography,
        ...currentTheme.portals[portalVar]?.typography,
      },
      brand: {
        ...currentTheme.brand,
        ...currentTheme.portals[portalVar]?.brand,
      },
    };
  };

  // Generate CSS variables for dynamic theming
  const getCSSVariables = (): Record<string, string> => {
    const portalTheme = getPortalTheme();
    const vars: Record<string, string> = {};

    // Color variables
    Object.entries(portalTheme.colors).forEach(([colorName, colorScale]) => {
      if (typeof colorScale === "object") {
        Object.entries(colorScale).forEach(([shade, value]) => {
          vars[`--color-${colorName}-${shade}`] = value;
        });
      }
    });

    // Typography variables
    vars["--font-family-sans"] = portalTheme.typography.fontFamily.sans.join(", ");
    vars["--font-family-serif"] = portalTheme.typography.fontFamily.serif.join(", ");
    vars["--font-family-mono"] = portalTheme.typography.fontFamily.mono.join(", ");

    // Spacing variables
    Object.entries(portalTheme.spacing).forEach(([key, value]) => {
      vars[`--spacing-${key}`] = value;
    });

    // Border radius variables
    Object.entries(portalTheme.borderRadius).forEach(([key, value]) => {
      vars[`--border-radius-${key}`] = value;
    });

    // Shadow variables
    Object.entries(portalTheme.shadows).forEach(([key, value]) => {
      vars[`--shadow-${key}`] = value;
    });

    return vars;
  };

  // Apply CSS variables to document root
  useEffect(() => {
    const cssVars = getCSSVariables();
    const root = document.documentElement;

    Object.entries(cssVars).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Apply custom CSS if provided
    const portalTheme = getPortalTheme();
    if (portalTheme.brand.customCss) {
      let styleEl = document.getElementById("dynamic-theme-css");
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "dynamic-theme-css";
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = portalTheme.brand.customCss;
    }

    return () => {
      // Cleanup on unmount
      Object.keys(cssVars).forEach((property) => {
        root.style.removeProperty(property);
      });
    };
  }, [currentTheme, portalVar]);

  const contextValue: ThemeContextType = {
    currentTheme,
    portalVariant: portalVar,
    setTheme: setCurrentTheme,
    setPortalVariant: setPortalVar,
    getPortalTheme,
    getCSSVariables,
  };

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

// Hook for consuming theme
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Utility hook for getting CSS classes based on current theme
export function useThemedClasses() {
  const { getPortalTheme, portalVariant } = useTheme();

  return {
    primary: `bg-[var(--color-primary-500)] text-white`,
    primaryHover: `hover:bg-[var(--color-primary-600)]`,
    secondary: `bg-[var(--color-secondary-100)] text-[var(--color-secondary-900)]`,
    border: `border-[var(--color-secondary-200)]`,
    background: `bg-[var(--color-neutral-50)]`,
    surface: `bg-white`,
    text: {
      primary: `text-[var(--color-neutral-900)]`,
      secondary: `text-[var(--color-neutral-600)]`,
      muted: `text-[var(--color-neutral-400)]`,
    },
    shadow: `shadow-[var(--shadow-md)]`,
    rounded: `rounded-[var(--border-radius-md)]`,
    spacing: {
      xs: `p-[var(--spacing-xs)]`,
      sm: `p-[var(--spacing-sm)]`,
      md: `p-[var(--spacing-md)]`,
      lg: `p-[var(--spacing-lg)]`,
    },
  };
}

export default ThemeProvider;
