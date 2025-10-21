/**
 * Theme Generator
 * Generates CSS custom properties and theme utilities
 */

import { designTokens, lightTheme, darkTheme } from "../tokens/design-tokens";

export interface ThemeConfig {
  enableDarkMode: boolean;
  enableSystemTheme: boolean;
  defaultTheme: "light" | "dark" | "system";
  storageKey: string;
  rootSelector: string;
  darkModeClass: string;
  lightModeClass: string;
  transitionDuration: string;
}

const defaultThemeConfig: ThemeConfig = {
  enableDarkMode: true,
  enableSystemTheme: true,
  defaultTheme: "system",
  storageKey: "theme-preference",
  rootSelector: ":root",
  darkModeClass: "dark",
  lightModeClass: "light",
  transitionDuration: "150ms",
};

export class ThemeGenerator {
  private config: ThemeConfig;
  private currentTheme: "light" | "dark" = "light";
  private systemTheme: "light" | "dark" = "light";
  private mediaQuery?: MediaQueryList;

  constructor(config: Partial<ThemeConfig> = {}) {
    this.config = { ...defaultThemeConfig, ...config };
    this.initializeTheme();
  }

  /**
   * Initialize theme system
   */
  private initializeTheme(): void {
    if (typeof window === "undefined") return;

    // Setup system theme detection
    if (this.config.enableSystemTheme) {
      this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      this.systemTheme = this.mediaQuery.matches ? "dark" : "light";

      this.mediaQuery.addEventListener("change", (e) => {
        this.systemTheme = e.matches ? "dark" : "light";
        if (this.config.defaultTheme === "system") {
          this.applyTheme(this.systemTheme);
        }
      });
    }

    // Load saved theme preference
    const savedTheme = this.getSavedTheme();
    const themeToApply = this.resolveTheme(savedTheme);
    this.applyTheme(themeToApply);
  }

  /**
   * Generate CSS custom properties for a theme
   */
  generateThemeCSS(themeName: "light" | "dark"): string {
    const theme = themeName === "light" ? lightTheme : darkTheme;
    const cssVars = designTokens.generateCSSCustomProperties(theme);

    let css = `${this.config.rootSelector} {\n`;

    // Add transition for smooth theme switching
    if (this.config.transitionDuration) {
      css += `  transition: background-color ${this.config.transitionDuration}, color ${this.config.transitionDuration};\n`;
    }

    // Add CSS custom properties
    Object.entries(cssVars).forEach(([property, value]) => {
      css += `  ${property}: ${value};\n`;
    });

    css += "}\n\n";

    // Add theme-specific overrides if dark theme
    if (themeName === "dark") {
      css += `.${this.config.darkModeClass} {\n`;

      Object.entries(theme.colors).forEach(([key, value]) => {
        const property = `--color-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
        css += `  ${property}: ${value};\n`;
      });

      css += "}\n\n";
    }

    return css;
  }

  /**
   * Generate complete CSS with both themes
   */
  generateCompleteCSS(): string {
    let css = "/* Design System Theme Variables */\n\n";

    // Base light theme
    css += this.generateThemeCSS("light");

    // Dark theme overrides
    if (this.config.enableDarkMode) {
      css += this.generateThemeCSS("dark");

      // System preference media query
      if (this.config.enableSystemTheme) {
        css += "@media (prefers-color-scheme: dark) {\n";
        css += `  ${this.config.rootSelector}:not(.${this.config.lightModeClass}) {\n`;

        Object.entries(darkTheme.colors).forEach(([key, value]) => {
          const property = `--color-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
          css += `    ${property}: ${value};\n`;
        });

        css += "  }\n";
        css += "}\n\n";
      }
    }

    // Utility classes
    css += this.generateUtilityClasses();

    return css;
  }

  /**
   * Generate utility classes for common design tokens
   */
  private generateUtilityClasses(): string {
    let css = "/* Utility Classes */\n\n";

    // Spacing utilities
    css += "/* Spacing */\n";
    Object.entries(designTokens.spacing).forEach(([key, value]) => {
      const className = key.replace(".", "\\.");
      css += `.m-${className} { margin: ${value}; }\n`;
      css += `.p-${className} { padding: ${value}; }\n`;
    });

    css += "\n";

    // Text utilities
    css += "/* Typography */\n";
    Object.entries(designTokens.typography.fontSizes).forEach(([key, value]) => {
      css += `.text-${key} { font-size: ${value}; }\n`;
    });

    css += "\n";

    Object.entries(designTokens.typography.fontWeights).forEach(([key, value]) => {
      css += `.font-${key} { font-weight: ${value}; }\n`;
    });

    css += "\n";

    // Border radius utilities
    css += "/* Border Radius */\n";
    Object.entries(designTokens.borderRadius).forEach(([key, value]) => {
      css += `.rounded-${key} { border-radius: ${value}; }\n`;
    });

    css += "\n";

    // Shadow utilities
    css += "/* Shadows */\n";
    Object.entries(designTokens.boxShadow).forEach(([key, value]) => {
      css += `.shadow-${key} { box-shadow: ${value}; }\n`;
    });

    css += "\n";

    // Theme-aware color utilities
    css += "/* Colors */\n";
    const colorKeys = ["primary", "secondary", "success", "warning", "error", "info"];
    colorKeys.forEach((color) => {
      css += `.text-${color} { color: var(--color-${color}); }\n`;
      css += `.bg-${color} { background-color: var(--color-${color}); }\n`;
      css += `.border-${color} { border-color: var(--color-${color}); }\n`;
    });

    return css;
  }

  /**
   * Apply theme to DOM
   */
  applyTheme(theme: "light" | "dark"): void {
    if (typeof document === "undefined") return;

    this.currentTheme = theme;
    const root = document.documentElement;

    // Remove existing theme classes
    root.classList.remove(this.config.lightModeClass, this.config.darkModeClass);

    // Add new theme class
    if (theme === "dark") {
      root.classList.add(this.config.darkModeClass);
    } else {
      root.classList.add(this.config.lightModeClass);
    }

    // Update theme-color meta tag for mobile browsers
    this.updateThemeColorMeta(theme);

    // Dispatch theme change event
    window.dispatchEvent(
      new CustomEvent("theme-changed", {
        detail: { theme, systemTheme: this.systemTheme },
      }),
    );
  }

  /**
   * Set theme preference
   */
  setTheme(theme: "light" | "dark" | "system"): void {
    this.saveTheme(theme);
    const resolvedTheme = this.resolveTheme(theme);
    this.applyTheme(resolvedTheme);
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): void {
    const newTheme = this.currentTheme === "light" ? "dark" : "light";
    this.setTheme(newTheme);
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): "light" | "dark" {
    return this.currentTheme;
  }

  /**
   * Get system theme preference
   */
  getSystemTheme(): "light" | "dark" {
    return this.systemTheme;
  }

  /**
   * Resolve theme preference to actual theme
   */
  private resolveTheme(theme: string): "light" | "dark" {
    if (theme === "system") {
      return this.systemTheme;
    }
    return theme === "dark" ? "dark" : "light";
  }

  /**
   * Save theme preference to storage
   */
  private saveTheme(theme: string): void {
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(this.config.storageKey, theme);
    } catch (error) {
      console.warn("Failed to save theme preference:", error);
    }
  }

  /**
   * Get saved theme preference from storage
   */
  private getSavedTheme(): string {
    if (typeof localStorage === "undefined") {
      return this.config.defaultTheme;
    }

    try {
      return localStorage.getItem(this.config.storageKey) || this.config.defaultTheme;
    } catch (error) {
      console.warn("Failed to load theme preference:", error);
      return this.config.defaultTheme;
    }
  }

  /**
   * Update theme-color meta tag for mobile browsers
   */
  private updateThemeColorMeta(theme: "light" | "dark"): void {
    const themeColors = {
      light: lightTheme.colors.background,
      dark: darkTheme.colors.background,
    };

    let metaTag = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;

    if (!metaTag) {
      metaTag = document.createElement("meta");
      metaTag.name = "theme-color";
      document.head.appendChild(metaTag);
    }

    metaTag.content = themeColors[theme];
  }

  /**
   * Inject CSS into the document
   */
  injectCSS(): void {
    if (typeof document === "undefined") return;

    const styleId = "design-system-theme-styles";
    let existingStyle = document.getElementById(styleId);

    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = this.generateCompleteCSS();

    document.head.appendChild(style);
  }

  /**
   * Get CSS custom properties object for current theme
   */
  getCSSVariables(): Record<string, string> {
    const theme = this.currentTheme === "light" ? lightTheme : darkTheme;
    return designTokens.generateCSSCustomProperties(theme);
  }

  /**
   * Create a style object for React components
   */
  createStyleObject(): React.CSSProperties {
    const cssVars = this.getCSSVariables();
    return cssVars as React.CSSProperties;
  }
}

// Default theme generator instance
export const themeGenerator = new ThemeGenerator();

// React hook for theme management
export const useTheme = () => {
  if (typeof window === "undefined") {
    return {
      theme: "light" as const,
      setTheme: () => {},
      toggleTheme: () => {},
      systemTheme: "light" as const,
      cssVariables: {},
    };
  }

  const [theme, setThemeState] = React.useState<"light" | "dark">(() =>
    themeGenerator.getCurrentTheme(),
  );

  const [systemTheme, setSystemTheme] = React.useState<"light" | "dark">(() =>
    themeGenerator.getSystemTheme(),
  );

  React.useEffect(() => {
    const handleThemeChange = (e: CustomEvent) => {
      setThemeState(e.detail.theme);
      setSystemTheme(e.detail.systemTheme);
    };

    window.addEventListener("theme-changed", handleThemeChange as EventListener);
    return () => window.removeEventListener("theme-changed", handleThemeChange as EventListener);
  }, []);

  const setTheme = React.useCallback((newTheme: "light" | "dark" | "system") => {
    themeGenerator.setTheme(newTheme);
  }, []);

  const toggleTheme = React.useCallback(() => {
    themeGenerator.toggleTheme();
  }, []);

  const cssVariables = React.useMemo(() => {
    return themeGenerator.getCSSVariables();
  }, [theme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    systemTheme,
    cssVariables,
  };
};

export default ThemeGenerator;
