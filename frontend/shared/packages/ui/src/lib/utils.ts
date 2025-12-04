/**
 * Portal utility functions (DEPRECATED)
 *
 * These utilities are maintained for backward compatibility only.
 * New code should use @dotmac/primitives UniversalTheme instead.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// ============================================================================
// Type Definitions
// ============================================================================

export type PortalType = "admin" | "customer" | "reseller" | "technician" | "management";

export interface PortalColorType {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

// ============================================================================
// Portal Configuration
// ============================================================================

const portalConfigs: Record<PortalType, PortalColorType> = {
  admin: {
    primary: "#3b82f6",
    secondary: "#1e40af",
    accent: "#60a5fa",
    background: "#f8fafc",
    text: "#1e293b",
  },
  customer: {
    primary: "#10b981",
    secondary: "#059669",
    accent: "#34d399",
    background: "#f0fdf4",
    text: "#064e3b",
  },
  reseller: {
    primary: "#8b5cf6",
    secondary: "#6d28d9",
    accent: "#a78bfa",
    background: "#faf5ff",
    text: "#4c1d95",
  },
  technician: {
    primary: "#f59e0b",
    secondary: "#d97706",
    accent: "#fbbf24",
    background: "#fffbeb",
    text: "#78350f",
  },
  management: {
    primary: "#6366f1",
    secondary: "#4f46e5",
    accent: "#818cf8",
    background: "#eef2ff",
    text: "#312e81",
  },
};

/**
 * Get portal configuration colors
 * @deprecated Use UniversalTheme from @dotmac/primitives instead
 */
export function getPortalConfig(portal: PortalType): PortalColorType {
  return portalConfigs[portal];
}

/**
 * Generate CSS variables for portal theme
 * @deprecated Use UniversalTheme from @dotmac/primitives instead
 */
export function generatePortalCSSVariables(portal: PortalType): Record<string, string> {
  const config = getPortalConfig(portal);
  return {
    "--portal-primary": config.primary,
    "--portal-secondary": config.secondary,
    "--portal-accent": config.accent,
    "--portal-background": config.background,
    "--portal-text": config.text,
  };
}

/**
 * Get portal theme class name
 * @deprecated Use UniversalTheme from @dotmac/primitives instead
 */
export function getPortalThemeClass(portal: PortalType): string {
  return `portal-theme-${portal}`;
}

/**
 * Combine class names using clsx + tailwind-merge to avoid style conflicts.
 */
export function cn(...classNames: ClassValue[]): string {
  return twMerge(clsx(classNames));
}
