/**
 * Theme Provider for DotMac Framework
 * Provides configurable theming across the application
 */

"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import { defaultTheme, type ThemeConfig, type ThemeName, themes } from "./theme.config";

interface ThemeContextType {
  theme: ThemeConfig;
  currentTheme: ThemeName;
  setTheme: (themeName: ThemeName) => void;
  customizeTheme: (customizations: Partial<ThemeConfig>) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultThemeName?: ThemeName;
  portalType?: "admin" | "customer" | "reseller";
  allowCustomization?: boolean;
}

export function ThemeProvider({
  children,
  defaultThemeName = "default",
  portalType,
  allowCustomization = true,
}: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>(() => {
    // Use portal-specific theme if specified
    if (portalType && themes[portalType]) {
      return portalType as ThemeName;
    }
    return defaultThemeName;
  });

  const [customizations, setCustomizations] = useState<Partial<ThemeConfig>>({});

  // Load theme customizations from localStorage
  useEffect(() => {
    if (allowCustomization && typeof window !== "undefined") {
      const savedCustomizations = window.localStorage.getItem(`dotmac-theme-${currentTheme}`);
      if (savedCustomizations) {
        try {
          const parsed = JSON.parse(savedCustomizations);
          setCustomizations(parsed);
        } catch (_error) {
          // Silently ignore parse errors for corrupted localStorage data
        }
      } else {
        setCustomizations({});
      }
    }
  }, [currentTheme, allowCustomization]);

  // Apply theme to CSS custom properties
  useEffect(() => {
    const baseTheme = themes[currentTheme] || defaultTheme;
    const finalTheme = {
      ...baseTheme,
      ...customizations,
      colors: {
        ...baseTheme.colors,
        ...(customizations.colors ||
          {
            // Implementation pending
          }),
      },
    };

    // Apply CSS custom properties
    const root = document.documentElement;

    // Apply color palette
    Object.entries(finalTheme.colors).forEach(([colorName, palette]) => {
      Object.entries(palette).forEach(([shade, value]) => {
        root.style.setProperty(`--color-${colorName}-${shade}`, value);
      });
    });

    // Apply typography
    if (finalTheme.typography?.fontFamily) {
      root.style.setProperty("--font-sans", finalTheme.typography.fontFamily.sans.join(", "));
      root.style.setProperty("--font-serif", finalTheme.typography.fontFamily.serif.join(", "));
      root.style.setProperty("--font-mono", finalTheme.typography.fontFamily.mono.join(", "));
    }

    // Apply spacing
    Object.entries(finalTheme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });

    // Apply border radius
    Object.entries(finalTheme.borderRadius).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, value);
    });

    // Apply shadows
    Object.entries(finalTheme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });

    // Apply breakpoints
    Object.entries(finalTheme.breakpoints).forEach(([key, value]) => {
      root.style.setProperty(`--breakpoint-${key}`, value);
    });

    // Apply z-index values
    Object.entries(finalTheme.zIndex).forEach(([key, value]) => {
      root.style.setProperty(`--z-${key}`, value);
    });
  }, [currentTheme, customizations]);

  const setTheme = (themeName: ThemeName) => {
    setCurrentTheme(themeName);
    setCustomizations({});
  };

  const customizeTheme = (newCustomizations: Partial<ThemeConfig>) => {
    if (!allowCustomization) {
      return;
    }

    const updatedCustomizations = {
      ...customizations,
      ...newCustomizations,
    };

    setCustomizations(updatedCustomizations);

    // Save to localStorage
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `dotmac-theme-${currentTheme}`,
          JSON.stringify(updatedCustomizations),
        );
      }
    } catch (_error) {
      // Silently ignore localStorage write errors (e.g., quota exceeded)
    }
  };

  const resetTheme = () => {
    setCustomizations({});
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(`dotmac-theme-${currentTheme}`);
    }
  };

  const theme = {
    ...(themes[currentTheme] || defaultTheme),
    ...customizations,
    colors: {
      ...(themes[currentTheme] || defaultTheme).colors,
      ...(customizations.colors ||
        {
          // Implementation pending
        }),
    },
  };

  const value: ThemeContextType = {
    theme,
    currentTheme,
    setTheme,
    customizeTheme,
    resetTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Hook to use theme
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Utility hooks for specific theme aspects
export function useColors() {
  const { theme } = useTheme();
  return theme.colors;
}

export function useTypography() {
  const { theme } = useTheme();
  return theme.typography;
}

export function useSpacing() {
  const { theme } = useTheme();
  return theme.spacing;
}

export function useBorderRadius() {
  const { theme } = useTheme();
  return theme.borderRadius;
}

export function useShadows() {
  const { theme } = useTheme();
  return theme.shadows;
}

export function useBreakpoints() {
  const { theme } = useTheme();
  return theme.breakpoints;
}
