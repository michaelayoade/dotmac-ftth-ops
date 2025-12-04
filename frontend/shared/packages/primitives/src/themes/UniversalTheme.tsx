/**
 * Universal Theme System
 * Extends the ISP Brand Theme with variant-based theming for all portal types
 */

"use client";

import React, { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { ISPColors, ISPGradients, ISPThemeUtils } from "./ISPBrandTheme";
import { cn } from "../utils/cn";

// Extended theme configuration for all portal variants
interface UniversalThemeConfig {
  variant: "admin" | "customer" | "reseller" | "technician" | "management";
  density: "compact" | "comfortable" | "spacious";
  colorScheme: "light" | "dark" | "system";
  accentColor: keyof typeof ISPColors;
  showBrandElements: boolean;
  animationsEnabled: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
}

// Portal-specific theme configurations
const portalThemes = {
  admin: {
    name: "Admin Portal",
    primaryColor: ISPColors.primary[600],
    secondaryColor: ISPColors.primary[100],
    backgroundColor: "#f8fafc", // slate-50
    surfaceColor: "#ffffff",
    textColor: "#1e293b", // slate-800
    gradient: ISPGradients.primary,
    accent: "primary" as const,
  },
  customer: {
    name: "Customer Portal",
    primaryColor: ISPColors.network[500],
    secondaryColor: ISPColors.network[100],
    backgroundColor: "#f0f9ff", // blue-50
    surfaceColor: "#ffffff",
    textColor: "#1e40af", // blue-800
    gradient: ISPGradients.network,
    accent: "network" as const,
  },
  reseller: {
    name: "Reseller Portal",
    primaryColor: "#9333ea", // purple-600
    secondaryColor: "#f3e8ff", // purple-100
    backgroundColor: "#fdf4ff", // purple-50
    surfaceColor: "#ffffff",
    textColor: "#7c2d12", // amber-900
    gradient: ISPGradients.premium,
    accent: "primary" as const,
  },
  technician: {
    name: "Technician Portal",
    primaryColor: ISPColors.network[600],
    secondaryColor: ISPColors.network[100],
    backgroundColor: "#f0fdf4", // green-50
    surfaceColor: "#ffffff",
    textColor: "#14532d", // green-900
    gradient: ISPGradients.network,
    accent: "network" as const,
  },
  management: {
    name: "Management Console",
    primaryColor: ISPColors.alert[600],
    secondaryColor: ISPColors.alert[100],
    backgroundColor: "#f9fafb", // gray-50
    surfaceColor: "#ffffff",
    textColor: "#111827", // gray-900
    gradient: ISPGradients.enterprise,
    accent: "alert" as const,
  },
};

const defaultThemeConfig: UniversalThemeConfig = {
  variant: "admin",
  density: "comfortable",
  colorScheme: "light",
  accentColor: "primary",
  showBrandElements: true,
  animationsEnabled: true,
  highContrast: false,
  reducedMotion: false,
};

const UniversalThemeContext = createContext<{
  config: UniversalThemeConfig;
  portalTheme: (typeof portalThemes)[keyof typeof portalThemes];
  updateConfig: (updates: Partial<UniversalThemeConfig>) => void;
  getThemeClasses: () => string;
  getCSSVariables: () => Record<string, string>;
}>({
  config: defaultThemeConfig,
  portalTheme: portalThemes.admin,
  updateConfig: () => {},
  getThemeClasses: () => "",
  getCSSVariables: () => ({}),
});

// Theme Provider Component
interface UniversalThemeProviderProps {
  children: ReactNode;
  config?: Partial<UniversalThemeConfig>;
}

export function UniversalThemeProvider({ children, config = {} }: UniversalThemeProviderProps) {
  const [themeConfig, setThemeConfig] = React.useState<UniversalThemeConfig>({
    ...defaultThemeConfig,
    ...config,
  });

  const portalTheme = portalThemes[themeConfig.variant];

  // Detect system preferences
  useEffect(() => {
    if (themeConfig.colorScheme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      // Would set dark mode here
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeConfig.colorScheme]);

  // Detect reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => {
      setThemeConfig((prev) => ({
        ...prev,
        reducedMotion: mediaQuery.matches,
      }));
    };

    handleChange(); // Set initial value
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const updateConfig = (updates: Partial<UniversalThemeConfig>) => {
    setThemeConfig((prev) => ({ ...prev, ...updates }));
  };

  const getThemeClasses = () => {
    return cn(
      "universal-theme",
      `theme-${themeConfig.variant}`,
      `density-${themeConfig.density}`,
      `color-${themeConfig.colorScheme}`,
      themeConfig.highContrast && "high-contrast",
      themeConfig.reducedMotion && "reduced-motion",
      !themeConfig.animationsEnabled && "no-animations",
    );
  };

  const getCSSVariables = () => {
    const variables: Record<string, string> = {
      // Portal-specific colors
      "--theme-primary": portalTheme.primaryColor,
      "--theme-secondary": portalTheme.secondaryColor,
      "--theme-background": portalTheme.backgroundColor,
      "--theme-surface": portalTheme.surfaceColor,
      "--theme-text": portalTheme.textColor,

      // Spacing based on density
      "--theme-spacing-xs":
        themeConfig.density === "compact"
          ? "0.25rem"
          : themeConfig.density === "comfortable"
            ? "0.5rem"
            : "0.75rem",
      "--theme-spacing-sm":
        themeConfig.density === "compact"
          ? "0.5rem"
          : themeConfig.density === "comfortable"
            ? "0.75rem"
            : "1rem",
      "--theme-spacing-md":
        themeConfig.density === "compact"
          ? "0.75rem"
          : themeConfig.density === "comfortable"
            ? "1rem"
            : "1.5rem",
      "--theme-spacing-lg":
        themeConfig.density === "compact"
          ? "1rem"
          : themeConfig.density === "comfortable"
            ? "1.5rem"
            : "2rem",

      // Border radius
      "--theme-radius-sm": "0.25rem",
      "--theme-radius-md": "0.375rem",
      "--theme-radius-lg": "0.5rem",
      "--theme-radius-xl": "0.75rem",

      // Shadows
      "--theme-shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      "--theme-shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      "--theme-shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",

      // Transitions
      "--theme-transition-fast": themeConfig.reducedMotion ? "none" : "150ms ease",
      "--theme-transition-normal": themeConfig.reducedMotion ? "none" : "300ms ease",
      "--theme-transition-slow": themeConfig.reducedMotion ? "none" : "500ms ease",
    };

    return variables;
  };

  // Apply CSS variables to document root
  useEffect(() => {
    const root = document.documentElement;
    const variables = getCSSVariables();

    Object.entries(variables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Apply portal-specific class to body
    document.body.className = cn(
      document.body.className.replace(/theme-\w+/g, ""), // Remove existing theme classes
      getThemeClasses(),
    );

    // Set document title
    document.title = portalTheme.name;

    return () => {
      // Cleanup CSS variables on unmount
      Object.keys(variables).forEach((property) => {
        root.style.removeProperty(property);
      });
    };
  }, [themeConfig, portalTheme]);

  const contextValue = {
    config: themeConfig,
    portalTheme,
    updateConfig,
    getThemeClasses,
    getCSSVariables,
  };

  return (
    <UniversalThemeContext.Provider value={contextValue}>
      <div
        className={cn(getThemeClasses(), "min-h-screen transition-all duration-300")}
        data-portal={themeConfig.variant}
        data-density={themeConfig.density}
        data-color-scheme={themeConfig.colorScheme}
        data-animations={themeConfig.animationsEnabled}
        data-high-contrast={themeConfig.highContrast}
        style={getCSSVariables()}
      >
        {children}
      </div>
    </UniversalThemeContext.Provider>
  );
}

// Hook to use universal theme
export function useUniversalTheme() {
  const context = useContext(UniversalThemeContext);
  if (!context) {
    throw new Error("useUniversalTheme must be used within a UniversalThemeProvider");
  }
  return context;
}

// Theme-aware component wrapper
interface ThemeAwareProps {
  children: ReactNode;
  variant?: "surface" | "elevated" | "outlined";
  className?: string;
}

export function ThemeAware({ children, variant = "surface", className }: ThemeAwareProps) {
  const { config, portalTheme } = useUniversalTheme();

  const variantClasses = {
    surface: "bg-white shadow-sm border border-gray-200",
    elevated: "bg-white shadow-md border border-gray-200",
    outlined: "bg-transparent border-2 border-gray-300",
  };

  return (
    <div
      className={cn(
        "rounded-lg transition-all duration-200",
        variantClasses[variant],
        config.highContrast && "border-gray-900",
        className,
      )}
      style={{
        borderColor: config.highContrast ? portalTheme.textColor : undefined,
        backgroundColor: variant !== "outlined" ? portalTheme.surfaceColor : undefined,
      }}
    >
      {children}
    </div>
  );
}

// Portal-specific brand component
interface PortalBrandProps {
  showLogo?: boolean;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PortalBrand({
  showLogo = true,
  showIcon = true,
  size = "md",
  className,
}: PortalBrandProps) {
  const { config, portalTheme } = useUniversalTheme();

  const sizeClasses = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
  };

  const iconSizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("flex items-center space-x-3", className)}>
      {showLogo && (
        <div
          className={cn(
            "flex items-center justify-center rounded-lg font-bold text-white",
            iconSizes[size],
          )}
          style={{ backgroundColor: portalTheme.primaryColor }}
        >
          {portalTheme.name
            .split(" ")
            .map((word) => word.charAt(0))
            .join("")
            .substring(0, 2)}
        </div>
      )}
      {showIcon && (
        <div
          className={cn("font-semibold", sizeClasses[size])}
          style={{ color: portalTheme.textColor }}
        >
          {portalTheme.name}
        </div>
      )}
    </div>
  );
}

// Theme utilities
export const UniversalThemeUtils = {
  ...ISPThemeUtils,

  getVariantTheme: (variant: UniversalThemeConfig["variant"]) => {
    return portalThemes[variant];
  },

  applyPortalStyles: (variant: UniversalThemeConfig["variant"], element: HTMLElement) => {
    const theme = portalThemes[variant];
    element.style.setProperty("--theme-primary", theme.primaryColor);
    element.style.setProperty("--theme-background", theme.backgroundColor);
    element.style.setProperty("--theme-text", theme.textColor);
  },

  generateThemeCSS: (config: UniversalThemeConfig) => {
    const theme = portalThemes[config.variant];
    return `
      .theme-${config.variant} {
        --theme-primary: ${theme.primaryColor};
        --theme-secondary: ${theme.secondaryColor};
        --theme-background: ${theme.backgroundColor};
        --theme-surface: ${theme.surfaceColor};
        --theme-text: ${theme.textColor};
      }
    `;
  },
};

// Export portal themes for external use
export { portalThemes };
export type { UniversalThemeConfig };
