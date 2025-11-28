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
export function applyThemeTokens(themeTokens: unknown): void {
  if (!themeTokens) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokens = themeTokens as any;

  // If it's a Theme object, use applyTheme directly
  if (tokens.colors && tokens.radius && tokens.font) {
    applyTheme(tokens as Theme);
    return;
  }

  // Otherwise apply raw CSS variables
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  Object.entries(tokens).forEach(([key, value]) => {
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

type BrandingConfig = {
  colors?: BrandingColors;
  logo?: { light?: string; dark?: string };
  logoUrl?: string;
  logoLight?: string;
  logoDark?: string;
  productName?: string;
  productTagline?: string;
  companyName?: string;
  supportEmail?: string;
  customCss?: Record<string, string | undefined>;
};

function resolveBrandingPalette(branding: BrandingConfig, mode: BrandThemeMode): BrandingColors {
  const colors = branding?.colors || {};
  const themeColors = (mode === "dark" ? colors.dark : colors.light) || (colors as BrandingColors);

  return {
    primary: themeColors.primary ?? colors.primary,
    primaryHover: themeColors.primaryHover ?? colors.primaryHover,
    primaryForeground: themeColors.primaryForeground ?? colors.primaryForeground,
    secondary: themeColors.secondary ?? colors.secondary,
    secondaryHover: themeColors.secondaryHover ?? colors.secondaryHover,
    secondaryForeground: themeColors.secondaryForeground ?? colors.secondaryForeground,
    accent: themeColors.accent ?? colors.accent,
    background: themeColors.background ?? colors.background,
    foreground: themeColors.foreground ?? colors.foreground,
  };
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

export function applyBrandingConfig(branding: unknown, options?: { theme?: BrandThemeMode }): void {
  if (!branding || typeof document === "undefined") return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brand = branding as any;
  const root = document.documentElement;
  const mode: BrandThemeMode = options?.theme === "dark" ? "dark" : "light";

  const lightPalette = resolveBrandingPalette(brand, "light");
  const darkPalette = resolveBrandingPalette(brand, "dark");
  const activePalette = mode === "dark" ? darkPalette : lightPalette;

  applyBrandingPalette(root, lightPalette, "light");
  applyBrandingPalette(root, darkPalette, "dark");
  applyBrandingPalette(root, activePalette);

  // Determine logos (support both new and legacy properties)
  const lightLogo = brand.logo?.light || brand.logoLight || brand.logoUrl;
  const darkLogo = brand.logo?.dark || brand.logoDark || brand.logoUrl;

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

  applyText("--brand-product-name", brand.productName);
  applyText("--brand-product-tagline", brand.productTagline);
  applyText("--brand-company-name", brand.companyName);
  applyText("--brand-support-email", brand.supportEmail);

  // Apply any additional custom CSS variables
  if (brand.customCss) {
    Object.entries(brand.customCss).forEach(([key, value]) => {
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
