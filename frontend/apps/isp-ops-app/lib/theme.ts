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
type BrandThemeMode = "light" | "dark";

type BrandingColors = {
  primary?: string;
  primaryHover?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryHover?: string;
  secondaryForeground?: string;
  accent?: string;
  background?: string;
  foreground?: string;
  light?: BrandingColors;
  dark?: BrandingColors;
};

function resolveBrandingPalette(branding: any, mode: BrandThemeMode): BrandingColors {
  const colors = (branding?.colors || {}) as BrandingColors;
  const themeColors = (mode === "dark" ? colors.dark : colors.light) || (colors as BrandingColors);

  const result: BrandingColors = {};

  const primary = themeColors.primary ?? colors.primary;
  if (primary) result.primary = primary;

  const primaryHover = themeColors.primaryHover ?? colors.primaryHover;
  if (primaryHover) result.primaryHover = primaryHover;

  const primaryForeground = themeColors.primaryForeground ?? colors.primaryForeground;
  if (primaryForeground) result.primaryForeground = primaryForeground;

  const secondary = themeColors.secondary ?? colors.secondary;
  if (secondary) result.secondary = secondary;

  const secondaryHover = themeColors.secondaryHover ?? colors.secondaryHover;
  if (secondaryHover) result.secondaryHover = secondaryHover;

  const secondaryForeground = themeColors.secondaryForeground ?? colors.secondaryForeground;
  if (secondaryForeground) result.secondaryForeground = secondaryForeground;

  const accent = themeColors.accent ?? colors.accent;
  if (accent) result.accent = accent;

  const background = themeColors.background ?? colors.background;
  if (background) result.background = background;

  const foreground = themeColors.foreground ?? colors.foreground;
  if (foreground) result.foreground = foreground;

  return result;
}

function applyBrandingPalette(
  root: HTMLElement,
  palette: BrandingColors,
  suffix?: BrandThemeMode,
): void {
  const suffixToken = suffix ? `-${suffix}` : "";
  const setVar = (name: string, value?: string) => {
    const varName = `${name}${suffixToken}`;
    if (value) {
      root.style.setProperty(varName, value);
    } else {
      root.style.removeProperty(varName);
    }
  };

  setVar("--brand-primary", palette.primary);
  setVar("--brand-primary-hover", palette.primaryHover ?? palette.primary);
  setVar("--brand-primary-foreground", palette.primaryForeground);
  setVar("--brand-secondary", palette.secondary);
  setVar("--brand-secondary-hover", palette.secondaryHover ?? palette.secondary);
  setVar("--brand-secondary-foreground", palette.secondaryForeground);
  setVar("--brand-accent", palette.accent);
  setVar("--brand-background", palette.background);
  setVar("--brand-foreground", palette.foreground);
}

export function applyBrandingConfig(branding: any, options?: { theme?: BrandThemeMode }): void {
  if (!branding || typeof document === "undefined") return;

  const root = document.documentElement;
  const mode: BrandThemeMode = options?.theme === "dark" ? "dark" : "light";

  const lightPalette = resolveBrandingPalette(branding, "light");
  const darkPalette = resolveBrandingPalette(branding, "dark");
  const activePalette = mode === "dark" ? darkPalette : lightPalette;

  applyBrandingPalette(root, lightPalette, "light");
  applyBrandingPalette(root, darkPalette, "dark");
  applyBrandingPalette(root, activePalette);

  // Determine logos (support both new and legacy properties)
  const lightLogo = branding.logo?.light || branding.logoLight || branding.logoUrl;
  const darkLogo = branding.logo?.dark || branding.logoDark || branding.logoUrl;

  if (lightLogo) {
    root.style.setProperty("--brand-logo-light", `url(${lightLogo})`);
  } else {
    root.style.removeProperty("--brand-logo-light");
  }
  if (darkLogo) {
    root.style.setProperty("--brand-logo-dark", `url(${darkLogo})`);
  } else {
    root.style.removeProperty("--brand-logo-dark");
  }

  // Text/brand metadata tokens
  const applyText = (cssVar: string, value?: string) => {
    if (value) {
      root.style.setProperty(cssVar, value);
    } else {
      root.style.removeProperty(cssVar);
    }
  };

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
};

export default theme;
