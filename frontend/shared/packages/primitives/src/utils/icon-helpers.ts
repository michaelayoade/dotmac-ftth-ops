/**
 * Icon Type Helper Utilities
 *
 * Provides type-safe wrappers for icon components to work around
 * exactOptionalPropertyTypes issues with Lucide icons.
 */

import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

/**
 * Safe icon type for dashboard components
 */
export type SafeIcon = ComponentType<{ className?: string }>;

/**
 * Convert Lucide icon to safe icon type
 *
 * @param icon - Lucide icon component
 * @returns Type-safe icon component
 *
 * @example
 * ```ts
 * const kpis = [{
 *   icon: toSafeIcon(Users),
 *   title: "Total Users"
 * }];
 * ```
 */
export const toSafeIcon = (icon: LucideIcon): SafeIcon => icon as any;

/**
 * Convert multiple icons at once
 *
 * @param icons - Array of Lucide icons
 * @returns Array of type-safe icons
 */
export const toSafeIcons = (icons: LucideIcon[]): SafeIcon[] => icons.map((icon) => icon as any);
