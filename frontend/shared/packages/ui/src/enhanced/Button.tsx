/**
 * Enhanced Button Component
 *
 * Extends base Button with accessibility warnings and best practices
 */

"use client";

import { warnMissingLabel, warnMissingButtonType } from "@dotmac/utils/a11y-dev-warnings";
import * as React from "react";

import { Button as BaseButton, type ButtonProps } from "../components/button";

export interface EnhancedButtonProps extends ButtonProps {
  /** Suppress accessibility warnings (not recommended) */
  suppressA11yWarnings?: boolean;
}

/**
 * Button with built-in accessibility checks
 *
 * Development warnings for:
 * - Missing accessible labels (for icon-only buttons)
 * - Missing button type in forms
 *
 * @example
 * ```tsx
 * // ✅ Good: Has visible text
 * <Button>Save</Button>
 *
 * // ✅ Good: Icon button with aria-label
 * <Button aria-label="Delete item">
 *   <TrashIcon />
 * </Button>
 *
 * // ⚠️ Warning: Icon button without label
 * <Button>
 *   <TrashIcon />
 * </Button>
 *
 * // ✅ Good: Explicit type in form
 * <form>
 *   <Button type="submit">Submit</Button>
 * </form>
 *
 * // ⚠️ Warning: No type specified
 * <form>
 *   <Button>Submit</Button>
 * </form>
 * ```
 */
export const Button = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({ children, suppressA11yWarnings, ...props }, ref) => {
    // Development-time accessibility checks
    React.useEffect(() => {
      if (suppressA11yWarnings) return;

      // Check for missing label
      warnMissingLabel("Button", { ...props, children });

      // Check for missing type in forms (if we can detect it)
      // Note: This is limited as we can't reliably detect if button is in a form
      if (props.type === undefined) {
        warnMissingButtonType(props.type, false);
      }
    }, [children, props, suppressA11yWarnings]);

    return (
      <BaseButton ref={ref} {...props}>
        {children}
      </BaseButton>
    );
  },
);

Button.displayName = "EnhancedButton";
