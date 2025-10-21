// DEPRECATED: This package is deprecated. Use @dotmac/primitives instead.
// These re-exports are maintained for backward compatibility only.

// Core components - re-exported from @dotmac/primitives
export { Button, buttonVariants } from "@dotmac/primitives";
export type { ButtonProps } from "@dotmac/primitives";

// Re-export other components from primitives if they exist
export { Input } from "@dotmac/primitives";
export { Card } from "@dotmac/primitives";
export { Modal } from "@dotmac/primitives";

// Portal utilities - maintained for compatibility but consider using UniversalTheme instead
export * from "./lib/utils";

// Types for backward compatibility
export type { PortalType, PortalColorType } from "./lib/utils";

// Export portal variants from primitives UniversalTheme for new code
export type { UniversalThemeConfig } from "@dotmac/primitives";
