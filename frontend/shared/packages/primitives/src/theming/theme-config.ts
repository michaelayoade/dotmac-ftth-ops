/**
 * Dynamic Theme Configuration for White-labeling
 * Generates theme variants from configuration instead of hardcoding
 */

import type { BrandTheme, PortalVariant } from "./theme-provider";

// Theme generation utilities
export interface ThemeConfig {
  brandColor: string; // Primary brand color
  accentColor?: string; // Secondary/accent color
  brandName: string; // Brand name
  logoUrl?: string; // Brand logo
  fontFamily?: string; // Custom font
  customCss?: string; // Additional CSS
}

// Generate full theme from minimal configuration
export function generateThemeFromConfig(config: ThemeConfig): BrandTheme {
  const { brandColor, accentColor, brandName, logoUrl, fontFamily, customCss } = config;

  // Generate color palette from brand color
  const primaryPalette = generateColorPalette(brandColor);
  const accentPalette = accentColor ? generateColorPalette(accentColor) : primaryPalette;

  return {
    id: `${brandName.toLowerCase().replace(/\s+/g, "-")}-theme`,
    name: `${brandName} Theme`,
    colors: {
      primary: primaryPalette,
      secondary: accentPalette,
      accent: accentPalette,
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
        sans: fontFamily
          ? [fontFamily, "system-ui", "sans-serif"]
          : ["Inter", "system-ui", "sans-serif"],
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
      name: brandName,
      ...(logoUrl ? { logo: { light: logoUrl, dark: logoUrl } } : {}),
      ...(customCss ? { customCss } : {}),
    },
  };
}

// Generate color palette from single hex color
function generateColorPalette(hexColor: string) {
  // Convert hex to HSL
  const hsl = hexToHsl(hexColor);

  return {
    50: hslToHex(hsl.h, Math.max(0, hsl.s - 20), Math.min(100, hsl.l + 45)),
    100: hslToHex(hsl.h, Math.max(0, hsl.s - 15), Math.min(100, hsl.l + 35)),
    200: hslToHex(hsl.h, Math.max(0, hsl.s - 10), Math.min(100, hsl.l + 25)),
    300: hslToHex(hsl.h, Math.max(0, hsl.s - 5), Math.min(100, hsl.l + 15)),
    400: hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + 8)),
    500: hexColor, // Base color
    600: hslToHex(hsl.h, Math.min(100, hsl.s + 5), Math.max(0, hsl.l - 8)),
    700: hslToHex(hsl.h, Math.min(100, hsl.s + 10), Math.max(0, hsl.l - 15)),
    800: hslToHex(hsl.h, Math.min(100, hsl.s + 15), Math.max(0, hsl.l - 25)),
    900: hslToHex(hsl.h, Math.min(100, hsl.s + 20), Math.max(0, hsl.l - 35)),
    950: hslToHex(hsl.h, Math.min(100, hsl.s + 25), Math.max(0, hsl.l - 45)),
  };
}

// Color conversion utilities
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= h && h < 1 / 6) {
    r = c;
    g = x;
    b = 0;
  } else if (1 / 6 <= h && h < 2 / 6) {
    r = x;
    g = c;
    b = 0;
  } else if (2 / 6 <= h && h < 3 / 6) {
    r = 0;
    g = c;
    b = x;
  } else if (3 / 6 <= h && h < 4 / 6) {
    r = 0;
    g = x;
    b = c;
  } else if (4 / 6 <= h && h < 5 / 6) {
    r = x;
    g = 0;
    b = c;
  } else if (5 / 6 <= h && h < 1) {
    r = c;
    g = 0;
    b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Predefined theme configurations for common ISP brands
export const commonISPThemes: Record<string, ThemeConfig> = {
  // Traditional ISP themes
  blueISP: {
    brandColor: "#1e40af",
    accentColor: "#059669",
    brandName: "BlueNet ISP",
    fontFamily: "Inter",
  },

  orangeISP: {
    brandColor: "#ea580c",
    accentColor: "#0369a1",
    brandName: "OrangeTech Communications",
    fontFamily: "Inter",
  },

  greenISP: {
    brandColor: "#059669",
    accentColor: "#7c3aed",
    brandName: "GreenWave Internet",
    fontFamily: "Inter",
  },

  purpleISP: {
    brandColor: "#7c3aed",
    accentColor: "#dc2626",
    brandName: "Purple Fiber Network",
    fontFamily: "Inter",
  },

  // Modern ISP themes
  darkTechISP: {
    brandColor: "#374151",
    accentColor: "#06b6d4",
    brandName: "DarkTech Networks",
    fontFamily: "Inter",
    customCss: `
      :root {
        --color-neutral-50: #1f2937;
        --color-neutral-100: #374151;
        --color-neutral-900: #f9fafb;
      }
    `,
  },

  // White-label generic
  genericISP: {
    brandColor: "#6b7280",
    accentColor: "#6b7280",
    brandName: "Generic ISP",
    fontFamily: "Inter",
  },
};

// Generate portal-specific theme variations
export function generatePortalThemes(baseConfig: ThemeConfig): Record<PortalVariant, BrandTheme> {
  const baseTheme = generateThemeFromConfig(baseConfig);

  // Create variations for different portals
  return {
    admin: {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: generateColorPalette("#1e40af"), // Admin blue
      },
    },

    customer: {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: generateColorPalette("#059669"), // Customer green
      },
    },

    reseller: {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: generateColorPalette("#7c3aed"), // Reseller purple
      },
    },

    technician: {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: generateColorPalette("#ea580c"), // Technician orange
      },
    },

    management: {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: generateColorPalette("#dc2626"), // Management red
      },
    },

    whitelabel: baseTheme, // Use brand colors as-is for white-label
  };
}

// Configuration loader for different environments
export class ThemeConfigLoader {
  private static cache = new Map<string, BrandTheme>();

  static async loadThemeConfig(
    source: "api" | "local" | "env",
    options: {
      apiEndpoint?: string;
      tenantId?: string;
      portalVariant?: PortalVariant;
      fallbackConfig?: ThemeConfig;
    } = {},
  ): Promise<BrandTheme> {
    const cacheKey = `${source}-${options.tenantId || "default"}-${options.portalVariant || "admin"}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    let theme: BrandTheme;

    switch (source) {
      case "api":
        theme = await this.loadFromAPI(options);
        break;

      case "env":
        theme = this.loadFromEnvironment(options);
        break;

      case "local":
      default:
        theme = this.loadFromLocalConfig(options);
        break;
    }

    this.cache.set(cacheKey, theme);
    return theme;
  }

  private static async loadFromAPI(options: any): Promise<BrandTheme> {
    if (!options.apiEndpoint) {
      throw new Error("API endpoint required for API theme loading");
    }

    try {
      const url = new URL(options.apiEndpoint);
      if (options.tenantId) url.searchParams.set("tenant", options.tenantId);
      if (options.portalVariant) url.searchParams.set("portal", options.portalVariant);

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.success && data.theme) {
        return data.theme;
      } else if (data.themeConfig) {
        return generateThemeFromConfig(data.themeConfig);
      }
    } catch (error) {
      console.warn("Failed to load theme from API:", error);
    }

    // Fallback to default
    return generateThemeFromConfig(options.fallbackConfig || commonISPThemes.genericISP);
  }

  private static loadFromEnvironment(options: any): BrandTheme {
    const config: ThemeConfig = {
      brandColor: process.env["REACT_APP_BRAND_COLOR"] || "#1e40af",
      brandName: process.env["REACT_APP_BRAND_NAME"] || "ISP Platform",
      ...(process.env["REACT_APP_ACCENT_COLOR"]
        ? { accentColor: process.env["REACT_APP_ACCENT_COLOR"] }
        : {}),
      ...(process.env["REACT_APP_LOGO_URL"] ? { logoUrl: process.env["REACT_APP_LOGO_URL"] } : {}),
      ...(process.env["REACT_APP_FONT_FAMILY"]
        ? { fontFamily: process.env["REACT_APP_FONT_FAMILY"] }
        : {}),
      ...(process.env["REACT_APP_CUSTOM_CSS"]
        ? { customCss: process.env["REACT_APP_CUSTOM_CSS"] }
        : {}),
    };

    return generateThemeFromConfig(config);
  }

  private static loadFromLocalConfig(options: any): BrandTheme {
    // Try to load from local configuration file or use fallback
    const configName = options.tenantId || "default";
    const storedConfig = localStorage.getItem(`theme-config-${configName}`);

    if (storedConfig) {
      try {
        const config = JSON.parse(storedConfig);
        return generateThemeFromConfig(config);
      } catch (error) {
        console.warn("Failed to parse stored theme config:", error);
      }
    }

    return generateThemeFromConfig(options.fallbackConfig || commonISPThemes.genericISP);
  }
}

export default {
  generateThemeFromConfig,
  commonISPThemes,
  generatePortalThemes,
  ThemeConfigLoader,
};
