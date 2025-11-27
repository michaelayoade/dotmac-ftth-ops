/**
 * Enhanced Input Component
 *
 * Extends base Input with accessibility warnings
 */

"use client";

import { warnMissingFormLabel } from "@dotmac/utils/a11y-dev-warnings";
import * as React from "react";

import { Input as BaseInput, type InputProps } from "../components/input";

export interface EnhancedInputProps extends InputProps {
  /** Associated label element ID */
  labelId?: string;
  /** Suppress accessibility warnings */
  suppressA11yWarnings?: boolean;
}

/**
 * Input with built-in accessibility checks
 *
 * Development warnings for:
 * - Missing associated label
 * - Missing aria-label or aria-labelledby
 *
 * @example
 * ```tsx
 * // ✅ Good: Associated with label
 * <label htmlFor="email">Email</label>
 * <Input id="email" type="email" />
 *
 * // ✅ Good: Has aria-label
 * <Input type="search" aria-label="Search customers" />
 *
 * // ⚠️ Warning: No label association
 * <Input type="text" placeholder="Enter name" />
 * ```
 */
export const Input = React.forwardRef<HTMLInputElement, EnhancedInputProps>(
  (
    {
      id,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledby,
      labelId,
      suppressA11yWarnings,
      ...props
    },
    ref,
  ) => {
    // Development-time accessibility checks
    React.useEffect(() => {
      if (suppressA11yWarnings) return;

      // Check for missing label
      warnMissingFormLabel(id, {
        "aria-label": ariaLabel,
        "aria-labelledby": ariaLabelledby || labelId,
        htmlFor: labelId,
      });
    }, [id, ariaLabel, ariaLabelledby, labelId, suppressA11yWarnings]);

    return (
      <BaseInput
        ref={ref}
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        {...props}
      />
    );
  },
);

Input.displayName = "EnhancedInput";
