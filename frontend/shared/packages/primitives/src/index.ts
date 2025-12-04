/**
 * @dotmac/primitives - Unstyled, composable UI primitives for DotMac platform
 *
 * This package provides headless UI components that can be styled with any design system.
 * Components are built with accessibility, composition, and flexibility in mind.
 */

export { Slot } from "@radix-ui/react-slot";
// Re-export common utilities
export { cva, type VariantProps } from "class-variance-authority";
export { clsx } from "clsx";
// Export what's actually implemented
export * from "./composition";
export * from "./data-display";
export * from "./dashboard";
export * from "./charts";
export * from "./maps";
export * from "./visualizations";
export * from "./error";
export * from "./feedback";
export * from "./forms";
export * from "./layout";
export { VirtualizedTable } from "./performance/VirtualizedTable";
export * from "./navigation";
export * from "./theming";
export {
  UniversalThemeProvider,
  useUniversalTheme,
  ThemeAware,
  PortalBrand,
} from "./themes/UniversalTheme";
export * from "./ui";
// Export utils excluding conflicting form utilities
export * from "./utils/bundle-optimization";
export * from "./utils/performance";
export * from "./utils/ssr";
export * from "./utils/accessibility";
export * from "./utils/icon-helpers";
// Skeleton loading components
export * from "./skeletons";

// Performance monitoring
export * from "./performance";
// Note: createValidationRules and validationPatterns exported from forms

// Export ErrorBoundary explicitly to avoid conflicts with error/ErrorBoundary
export { ErrorBoundary as ComponentErrorBoundary } from "./components/ErrorBoundary";
export * from "./utils/security";
export * from "./animations/Animations";
export * from "./themes/ISPBrandTheme";
export * from "./security/CSRFProtection";

// Version info
export const version = "1.0.0";

// Default configurations
export const defaultConfig = {
  toast: {
    duration: 5000,
    position: "top-right" as const,
  },
  table: {
    pageSize: 10,
    showPagination: true,
  },
  chart: {
    responsive: true,
    height: 300,
  },
  form: {
    layout: "vertical" as const,
    size: "md" as const,
  },
  modal: {
    closeOnOverlayClick: true,
    closeOnEscape: true,
  },
} as const;
