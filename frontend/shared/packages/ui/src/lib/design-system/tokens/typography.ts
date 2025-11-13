/**
 * Design System - Typography Tokens
 *
 * Font scales optimized for each portal's use case
 * Customer portal uses larger sizes for accessibility
 */

import type { PortalType } from "./colors";

/**
 * Base font families
 */
export const fontFamily = {
  sans: [
    "Inter",
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ].join(", "),
  mono: ["JetBrains Mono", "Fira Code", "Consolas", "Monaco", "Courier New", "monospace"].join(
    ", ",
  ),
} as const;

/**
 * Portal-specific font scales
 */
export const portalFontSizes = {
  /**
   * Admin Portals - Standard sizes for dense information
   */
  platformAdmin: {
    xs: ["0.75rem", { lineHeight: "1rem" }], // 12px
    sm: ["0.875rem", { lineHeight: "1.25rem" }], // 14px
    base: ["1rem", { lineHeight: "1.5rem" }], // 16px
    lg: ["1.125rem", { lineHeight: "1.75rem" }], // 18px
    xl: ["1.25rem", { lineHeight: "1.75rem" }], // 20px
    "2xl": ["1.5rem", { lineHeight: "2rem" }], // 24px
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }], // 30px
    "4xl": ["2.25rem", { lineHeight: "2.5rem" }], // 36px
  },

  platformResellers: {
    xs: ["0.75rem", { lineHeight: "1rem" }], // 12px
    sm: ["0.875rem", { lineHeight: "1.25rem" }], // 14px
    base: ["1rem", { lineHeight: "1.5rem" }], // 16px
    lg: ["1.125rem", { lineHeight: "1.75rem" }], // 18px
    xl: ["1.25rem", { lineHeight: "1.75rem" }], // 20px
    "2xl": ["1.5rem", { lineHeight: "2rem" }], // 24px
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }], // 30px
    "4xl": ["2.25rem", { lineHeight: "2.5rem" }], // 36px
  },

  platformTenants: {
    xs: ["0.75rem", { lineHeight: "1rem" }], // 12px
    sm: ["0.875rem", { lineHeight: "1.25rem" }], // 14px
    base: ["1rem", { lineHeight: "1.5rem" }], // 16px
    lg: ["1.125rem", { lineHeight: "1.75rem" }], // 18px
    xl: ["1.25rem", { lineHeight: "1.75rem" }], // 20px
    "2xl": ["1.5rem", { lineHeight: "2rem" }], // 24px
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }], // 30px
    "4xl": ["2.25rem", { lineHeight: "2.5rem" }], // 36px
  },

  ispAdmin: {
    xs: ["0.75rem", { lineHeight: "1rem" }], // 12px
    sm: ["0.875rem", { lineHeight: "1.25rem" }], // 14px
    base: ["1rem", { lineHeight: "1.5rem" }], // 16px
    lg: ["1.125rem", { lineHeight: "1.75rem" }], // 18px
    xl: ["1.25rem", { lineHeight: "1.75rem" }], // 20px
    "2xl": ["1.5rem", { lineHeight: "2rem" }], // 24px
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }], // 30px
    "4xl": ["2.25rem", { lineHeight: "2.5rem" }], // 36px
  },

  /**
   * Reseller Portal - Slightly larger for mobile
   */
  ispReseller: {
    xs: ["0.875rem", { lineHeight: "1.25rem" }], // 14px
    sm: ["1rem", { lineHeight: "1.5rem" }], // 16px
    base: ["1.125rem", { lineHeight: "1.75rem" }], // 18px
    lg: ["1.25rem", { lineHeight: "1.75rem" }], // 20px
    xl: ["1.5rem", { lineHeight: "2rem" }], // 24px
    "2xl": ["1.875rem", { lineHeight: "2.25rem" }], // 30px
    "3xl": ["2.25rem", { lineHeight: "2.5rem" }], // 36px
    "4xl": ["3rem", { lineHeight: "3.5rem" }], // 48px
  },

  /**
   * Customer Portal - Largest sizes for accessibility
   */
  ispCustomer: {
    xs: ["1rem", { lineHeight: "1.5rem" }], // 16px (no smaller!)
    sm: ["1.125rem", { lineHeight: "1.75rem" }], // 18px
    base: ["1.25rem", { lineHeight: "1.875rem" }], // 20px ⬅️ Body text
    lg: ["1.5rem", { lineHeight: "2rem" }], // 24px
    xl: ["1.875rem", { lineHeight: "2.25rem" }], // 30px
    "2xl": ["2.25rem", { lineHeight: "2.5rem" }], // 36px
    "3xl": ["3rem", { lineHeight: "3.5rem" }], // 48px
    "4xl": ["3.75rem", { lineHeight: "4rem" }], // 60px
  },
} as const;

/**
 * Font weights
 */
export const fontWeight = {
  thin: "100",
  extralight: "200",
  light: "300",
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
} as const;

/**
 * Get font sizes for a specific portal
 */
export function getPortalFontSizes(portal: PortalType) {
  return portalFontSizes[portal];
}

/**
 * Recommended reading widths for optimal readability
 */
export const readingWidth = {
  narrow: "45ch", // Dense data tables
  optimal: "65ch", // Standard reading
  wide: "75ch", // Wide content
} as const;
