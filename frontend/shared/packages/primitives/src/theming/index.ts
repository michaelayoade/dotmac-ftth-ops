/**
 * Theming utilities for DotMac platform
 */

export interface PortalThemeConfig {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    foreground: string;
    muted: string;
    accent: string;
    destructive: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
  };
}

export const defaultTheme: PortalThemeConfig = {
  name: "default",
  colors: {
    primary: "#3b82f6",
    secondary: "#64748b",
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#f1f5f9",
    accent: "#f59e0b",
    destructive: "#dc2626",
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
  typography: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
    },
  },
};

export const adminTheme: PortalThemeConfig = {
  ...defaultTheme,
  name: "admin",
  colors: {
    ...defaultTheme.colors,
    primary: "#1e40af",
    accent: "#059669",
  },
};

export const customerTheme: PortalThemeConfig = {
  ...defaultTheme,
  name: "customer",
  colors: {
    ...defaultTheme.colors,
    primary: "#7c3aed",
    accent: "#db2777",
  },
};

export const resellerTheme: PortalThemeConfig = {
  ...defaultTheme,
  name: "reseller",
  colors: {
    ...defaultTheme.colors,
    primary: "#dc2626",
    accent: "#ea580c",
  },
};

export function createPortalTheme(portal: "admin" | "customer" | "reseller"): PortalThemeConfig {
  switch (portal) {
    case "admin":
      return adminTheme;
    case "customer":
      return customerTheme;
    case "reseller":
      return resellerTheme;
    default:
      return defaultTheme;
  }
}

export function applyTheme(theme: PortalThemeConfig) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  // Apply CSS custom properties
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });

  Object.entries(theme.spacing).forEach(([key, value]) => {
    root.style.setProperty(`--spacing-${key}`, value);
  });

  Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
    root.style.setProperty(`--font-size-${key}`, value);
  });

  root.style.setProperty("--font-family", theme.typography.fontFamily);
}

export const themes = {
  default: defaultTheme,
  admin: adminTheme,
  customer: customerTheme,
  reseller: resellerTheme,
};
