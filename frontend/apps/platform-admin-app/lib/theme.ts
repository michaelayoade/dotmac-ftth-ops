/**
 * Theme Configuration
 *
 * Theme settings and utilities for the application.
 */

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  radius: string;
  font: string;
}

export const defaultTheme: Theme = {
  name: "default",
  colors: {
    primary: "hsl(222.2 47.4% 11.2%)",
    secondary: "hsl(210 40% 96.1%)",
    accent: "hsl(210 40% 96.1%)",
    background: "hsl(0 0% 100%)",
    foreground: "hsl(222.2 84% 4.9%)",
    muted: "hsl(210 40% 96.1%)",
    border: "hsl(214.3 31.8% 91.4%)",
  },
  radius: "0.5rem",
  font: "system-ui, sans-serif",
};

export const darkTheme: Theme = {
  name: "dark",
  colors: {
    primary: "hsl(210 40% 98%)",
    secondary: "hsl(217.2 32.6% 17.5%)",
    accent: "hsl(217.2 32.6% 17.5%)",
    background: "hsl(222.2 84% 4.9%)",
    foreground: "hsl(210 40% 98%)",
    muted: "hsl(217.2 32.6% 17.5%)",
    border: "hsl(217.2 32.6% 17.5%)",
  },
  radius: "0.5rem",
  font: "system-ui, sans-serif",
};

/**
 * Apply theme to document
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Apply CSS variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });

  root.style.setProperty("--radius", theme.radius);
  root.style.setProperty("--font-sans", theme.font);
}

/**
 * Get current theme from localStorage
 */
export function getCurrentTheme(): string {
  if (typeof window === "undefined") return "light";

  return localStorage.getItem("theme") || "light";
}

/**
 * Set theme and persist to localStorage
 */
export function setTheme(themeName: "light" | "dark"): void {
  if (typeof window === "undefined") return;

  localStorage.setItem("theme", themeName);

  const theme = themeName === "dark" ? darkTheme : defaultTheme;
  applyTheme(theme);

  // Update document class for Tailwind dark mode
  if (themeName === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

/**
 * Toggle between light and dark themes
 */
export function toggleTheme(): void {
  const current = getCurrentTheme();
  const newTheme = current === "dark" ? "light" : "dark";
  setTheme(newTheme as "light" | "dark");
}

/**
 * Initialize theme on app load
 */
export function initializeTheme(): void {
  const savedTheme = getCurrentTheme();
  setTheme(savedTheme as "light" | "dark");
}

/**
 * Apply theme tokens (alias for applyTheme for backwards compatibility)
 */
export function applyThemeTokens(themeTokens: any): void {
  if (!themeTokens) return;

  // If it's a Theme object, use applyTheme directly
  if (themeTokens.colors && themeTokens.radius && themeTokens.font) {
    applyTheme(themeTokens);
    return;
  }

  // Otherwise apply raw CSS variables
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  Object.entries(themeTokens).forEach(([key, value]) => {
    if (typeof value === "string") {
      root.style.setProperty(`--${key}`, value);
    }
  });
}

/**
 * Apply branding configuration
 */
export function applyBrandingConfig(branding: any): void {
  if (!branding || typeof document === "undefined") return;

  const root = document.documentElement;

  // Determine logos (support both new and legacy properties)
  const lightLogo = branding.logo?.light || branding.logoLight || branding.logoUrl;
  const darkLogo = branding.logo?.dark || branding.logoDark || branding.logoUrl;

  if (lightLogo) {
    root.style.setProperty("--brand-logo-light", `url(${lightLogo})`);
  }
  if (darkLogo) {
    root.style.setProperty("--brand-logo-dark", `url(${darkLogo})`);
  }

  // Helper to apply color tokens with sensible defaults
  const applyColor = (cssVar: string, value?: string) => {
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  };

  const applyText = (cssVar: string, value?: string) => {
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  };

  // Primary palette
  applyColor("--brand-primary", branding.primaryColor || branding.colors?.primary);
  applyColor("--brand-primary-hover", branding.primaryHoverColor || branding.colors?.primaryHover);
  applyColor(
    "--brand-primary-foreground",
    branding.primaryForegroundColor || branding.colors?.primaryForeground,
  );

  // Secondary palette
  applyColor("--brand-secondary", branding.secondaryColor || branding.colors?.secondary);
  applyColor(
    "--brand-secondary-hover",
    branding.secondaryHoverColor || branding.colors?.secondaryHover,
  );
  applyColor(
    "--brand-secondary-foreground",
    branding.secondaryForegroundColor || branding.colors?.secondaryForeground,
  );

  // Accent/background/foreground tokens (optional)
  applyColor("--brand-accent", branding.accentColor || branding.colors?.accent);
  applyColor("--brand-background", branding.backgroundColor || branding.colors?.background);
  applyColor("--brand-foreground", branding.foregroundColor || branding.colors?.foreground);

  // Text/brand metadata tokens
  applyText("--brand-product-name", branding.productName);
  applyText("--brand-product-tagline", branding.productTagline);
  applyText("--brand-company-name", branding.companyName);
  applyText("--brand-support-email", branding.supportEmail);

  // Apply any additional custom CSS variables
  if (branding.customCss) {
    Object.entries(branding.customCss).forEach(([key, value]) => {
      if (typeof value === "string") {
        root.style.setProperty(key, value);
      }
    });
  }
}

export const theme = {
  default: defaultTheme,
  dark: darkTheme,
  apply: applyTheme,
  applyTokens: applyThemeTokens,
  applyBranding: applyBrandingConfig,
  getCurrent: getCurrentTheme,
  set: setTheme,
  toggle: toggleTheme,
  initialize: initializeTheme,
};

export default theme;
