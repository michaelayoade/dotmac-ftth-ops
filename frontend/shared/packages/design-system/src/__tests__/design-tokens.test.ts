/**
 * Design Tokens Tests
 */

import {
  colors,
  typography,
  spacing,
  borderRadius,
  boxShadow,
  zIndex,
  animation,
  breakpoints,
  components,
  lightTheme,
  darkTheme,
  generateCSSCustomProperties,
  designTokens,
} from "../tokens/design-tokens";

describe("Design Tokens", () => {
  describe("colors", () => {
    it("has primary color palette with all shades", () => {
      expect(colors.primary).toBeDefined();
      expect(colors.primary[500]).toBe("#3b82f6");
      expect(colors.primary[50]).toBe("#eff6ff");
      expect(colors.primary[900]).toBe("#1e3a8a");
    });

    it("has secondary color palette", () => {
      expect(colors.secondary).toBeDefined();
      expect(colors.secondary[500]).toBe("#64748b");
    });

    it("has status colors", () => {
      expect(colors.success[500]).toBe("#22c55e");
      expect(colors.warning[500]).toBe("#f59e0b");
      expect(colors.error[500]).toBe("#ef4444");
      expect(colors.info[500]).toBe("#3b82f6");
    });

    it("has neutral grayscale", () => {
      expect(colors.neutral[50]).toBe("#f9fafb");
      expect(colors.neutral[900]).toBe("#111827");
    });
  });

  describe("typography", () => {
    it("has font families defined", () => {
      expect(typography.fontFamilies.sans).toContain("Inter");
      expect(typography.fontFamilies.mono).toContain("JetBrains Mono");
      expect(typography.fontFamilies.serif).toContain("Georgia");
    });

    it("has font size scale", () => {
      expect(typography.fontSizes.xs).toBe("0.75rem");
      expect(typography.fontSizes.base).toBe("1rem");
      expect(typography.fontSizes["4xl"]).toBe("2.25rem");
    });

    it("has font weights", () => {
      expect(typography.fontWeights.normal).toBe(400);
      expect(typography.fontWeights.bold).toBe(700);
      expect(typography.fontWeights.thin).toBe(100);
    });

    it("has line heights", () => {
      expect(typography.lineHeights.normal).toBe(1.5);
      expect(typography.lineHeights.tight).toBe(1.25);
    });

    it("has letter spacing", () => {
      expect(typography.letterSpacing.normal).toBe("0");
      expect(typography.letterSpacing.wide).toBe("0.025em");
    });
  });

  describe("spacing", () => {
    it("has 0 and px spacing", () => {
      expect(spacing[0]).toBe("0");
      expect(spacing.px).toBe("1px");
    });

    it("follows 4px base scale", () => {
      expect(spacing[1]).toBe("0.25rem"); // 4px
      expect(spacing[2]).toBe("0.5rem"); // 8px
      expect(spacing[4]).toBe("1rem"); // 16px
      expect(spacing[8]).toBe("2rem"); // 32px
    });

    it("has fractional spacing values", () => {
      expect(spacing[0.5]).toBe("0.125rem");
      expect(spacing[1.5]).toBe("0.375rem");
      expect(spacing[2.5]).toBe("0.625rem");
    });

    it("has large spacing values", () => {
      expect(spacing[96]).toBe("24rem");
    });
  });

  describe("borderRadius", () => {
    it("has standard radius values", () => {
      expect(borderRadius.none).toBe("0");
      expect(borderRadius.sm).toBe("0.125rem");
      expect(borderRadius.base).toBe("0.25rem");
      expect(borderRadius.lg).toBe("0.5rem");
      expect(borderRadius.full).toBe("9999px");
    });
  });

  describe("boxShadow", () => {
    it("has shadow scale", () => {
      expect(boxShadow.none).toBe("none");
      expect(boxShadow.sm).toContain("rgb(0 0 0 / 0.05)");
      expect(boxShadow.lg).toContain("rgb(0 0 0 / 0.1)");
      expect(boxShadow.inner).toContain("inset");
    });
  });

  describe("zIndex", () => {
    it("has layering system", () => {
      expect(zIndex.hide).toBe(-1);
      expect(zIndex.base).toBe(0);
      expect(zIndex.dropdown).toBe(1000);
      expect(zIndex.modal).toBe(1400);
      expect(zIndex.toast).toBe(1700);
      expect(zIndex.tooltip).toBe(1800);
    });

    it("maintains proper z-index hierarchy", () => {
      expect(zIndex.dropdown).toBeLessThan(zIndex.modal);
      expect(zIndex.modal).toBeLessThan(zIndex.toast);
      expect(zIndex.toast).toBeLessThan(zIndex.tooltip);
    });
  });

  describe("animation", () => {
    it("has duration scale", () => {
      expect(animation.durations.none).toBe("0s");
      expect(animation.durations.fast).toBe("150ms");
      expect(animation.durations.base).toBe("250ms");
      expect(animation.durations.slow).toBe("350ms");
    });

    it("has easing functions", () => {
      expect(animation.easings.linear).toBe("linear");
      expect(animation.easings.easeInOut).toBe("ease-in-out");
      expect(animation.easings.bounce).toContain("cubic-bezier");
    });
  });

  describe("breakpoints", () => {
    it("has responsive breakpoints", () => {
      expect(breakpoints.xs).toBe("320px");
      expect(breakpoints.sm).toBe("640px");
      expect(breakpoints.md).toBe("768px");
      expect(breakpoints.lg).toBe("1024px");
      expect(breakpoints.xl).toBe("1280px");
      expect(breakpoints["2xl"]).toBe("1536px");
    });

    it("breakpoints are in ascending order", () => {
      const values = Object.values(breakpoints).map((v) => parseInt(v));
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]!);
      }
    });
  });

  describe("components", () => {
    it("has button component tokens", () => {
      expect(components.button.heights).toBeDefined();
      expect(components.button.paddingX).toBeDefined();
      expect(components.button.heights.md).toBe(spacing[10]);
    });

    it("has input component tokens", () => {
      expect(components.input.heights).toBeDefined();
      expect(components.input.paddingX).toBe(spacing[3]);
    });

    it("has card component tokens", () => {
      expect(components.card.padding).toBeDefined();
      expect(components.card.borderRadius).toBe(borderRadius.lg);
    });

    it("has modal component tokens", () => {
      expect(components.modal.maxWidths).toBeDefined();
      expect(components.modal.maxWidths.lg).toBe("32rem");
    });
  });
});

describe("Theme Definitions", () => {
  describe("lightTheme", () => {
    it("has all required color properties", () => {
      expect(lightTheme.colors.background).toBeDefined();
      expect(lightTheme.colors.surface).toBeDefined();
      expect(lightTheme.colors.primary).toBeDefined();
      expect(lightTheme.colors.text).toBeDefined();
      expect(lightTheme.colors.border).toBeDefined();
    });

    it("uses light color values", () => {
      expect(lightTheme.colors.background).toBe(colors.neutral[50]);
      expect(lightTheme.colors.text).toBe(colors.neutral[900]);
    });

    it("has status colors", () => {
      expect(lightTheme.colors.success).toBe(colors.success[600]);
      expect(lightTheme.colors.warning).toBe(colors.warning[500]);
      expect(lightTheme.colors.error).toBe(colors.error[600]);
    });
  });

  describe("darkTheme", () => {
    it("has all required color properties", () => {
      expect(darkTheme.colors.background).toBeDefined();
      expect(darkTheme.colors.surface).toBeDefined();
      expect(darkTheme.colors.primary).toBeDefined();
      expect(darkTheme.colors.text).toBeDefined();
      expect(darkTheme.colors.border).toBeDefined();
    });

    it("uses dark color values", () => {
      expect(darkTheme.colors.background).toBe(colors.neutral[900]);
      expect(darkTheme.colors.text).toBe(colors.neutral[100]);
    });

    it("inverts surface colors from light theme", () => {
      expect(darkTheme.colors.surface).not.toBe(lightTheme.colors.surface);
    });
  });
});

describe("generateCSSCustomProperties()", () => {
  it("generates CSS custom properties for light theme", () => {
    const cssVars = generateCSSCustomProperties(lightTheme);

    expect(cssVars["--color-background"]).toBe(lightTheme.colors.background);
    expect(cssVars["--color-primary"]).toBe(lightTheme.colors.primary);
    expect(cssVars["--color-text"]).toBe(lightTheme.colors.text);
  });

  it("generates CSS custom properties for dark theme", () => {
    const cssVars = generateCSSCustomProperties(darkTheme);

    expect(cssVars["--color-background"]).toBe(darkTheme.colors.background);
    expect(cssVars["--color-text"]).toBe(darkTheme.colors.text);
  });

  it("generates spacing variables", () => {
    const cssVars = generateCSSCustomProperties(lightTheme);

    expect(cssVars["--spacing-0"]).toBe("0");
    expect(cssVars["--spacing-4"]).toBe("1rem");
    expect(cssVars["--spacing-8"]).toBe("2rem");
  });

  it("generates typography variables", () => {
    const cssVars = generateCSSCustomProperties(lightTheme);

    expect(cssVars["--font-size-base"]).toBe("1rem");
    expect(cssVars["--font-weight-bold"]).toBe("700");
    expect(cssVars["--line-height-normal"]).toBe("1.5");
  });

  it("generates border radius variables", () => {
    const cssVars = generateCSSCustomProperties(lightTheme);

    expect(cssVars["--border-radius-sm"]).toBe("0.125rem");
    expect(cssVars["--border-radius-lg"]).toBe("0.5rem");
  });

  it("generates shadow variables", () => {
    const cssVars = generateCSSCustomProperties(lightTheme);

    expect(cssVars["--shadow-none"]).toBe("none");
    expect(cssVars["--shadow-sm"]).toContain("rgb(0 0 0");
  });

  it("generates z-index variables", () => {
    const cssVars = generateCSSCustomProperties(lightTheme);

    expect(cssVars["--z-index-modal"]).toBe("1400");
    expect(cssVars["--z-index-tooltip"]).toBe("1800");
  });

  it("generates animation variables", () => {
    const cssVars = generateCSSCustomProperties(lightTheme);

    expect(cssVars["--duration-fast"]).toBe("150ms");
    expect(cssVars["--easing-ease-in-out"]).toBe("ease-in-out");
  });

  it("converts camelCase keys to kebab-case", () => {
    const cssVars = generateCSSCustomProperties(lightTheme);

    // Check that camelCase colors are converted
    expect(cssVars["--color-text-secondary"]).toBe(lightTheme.colors.textSecondary);
    expect(cssVars["--color-surface-variant"]).toBe(lightTheme.colors.surfaceVariant);
  });
});

describe("designTokens export", () => {
  it("exports all token categories", () => {
    expect(designTokens.colors).toBe(colors);
    expect(designTokens.typography).toBe(typography);
    expect(designTokens.spacing).toBe(spacing);
    expect(designTokens.borderRadius).toBe(borderRadius);
    expect(designTokens.boxShadow).toBe(boxShadow);
    expect(designTokens.zIndex).toBe(zIndex);
    expect(designTokens.animation).toBe(animation);
    expect(designTokens.breakpoints).toBe(breakpoints);
    expect(designTokens.components).toBe(components);
  });

  it("exports themes", () => {
    expect(designTokens.themes.light).toBe(lightTheme);
    expect(designTokens.themes.dark).toBe(darkTheme);
  });

  it("exports generateCSSCustomProperties function", () => {
    expect(designTokens.generateCSSCustomProperties).toBe(generateCSSCustomProperties);
  });
});
