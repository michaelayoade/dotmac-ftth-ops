/**
 * Enhanced Link Component
 *
 * Extends Next.js Link with accessibility warnings
 */

"use client";

import { warnMissingLabel } from "@dotmac/utils/a11y-dev-warnings";
import NextLink, { type LinkProps as NextLinkProps } from "next/link";
import * as React from "react";

export interface EnhancedLinkProps extends NextLinkProps {
  children: React.ReactNode;
  /** ARIA label for link */
  "aria-label"?: string;
  /** Suppress accessibility warnings */
  suppressA11yWarnings?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Link with built-in accessibility checks
 *
 * Development warnings for:
 * - Links with only icons (no text)
 * - Ambiguous link text ("click here", "read more")
 *
 * @example
 * ```tsx
 * // ✅ Good: Descriptive link text
 * <Link href="/customers">View all customers</Link>
 *
 * // ✅ Good: Icon link with aria-label
 * <Link href="/settings" aria-label="Settings">
 *   <SettingsIcon />
 * </Link>
 *
 * // ⚠️ Warning: Icon only without label
 * <Link href="/profile">
 *   <UserIcon />
 * </Link>
 *
 * // ⚠️ Warning: Ambiguous link text
 * <Link href="/article">Read more</Link>
 * ```
 */
export const Link = React.forwardRef<HTMLAnchorElement, EnhancedLinkProps>(
  ({ children, "aria-label": ariaLabel, suppressA11yWarnings, ...props }, ref) => {
    // Development-time accessibility checks
    React.useEffect(() => {
      if (suppressA11yWarnings) return;

      // Check for missing label
      warnMissingLabel("Link", { children, "aria-label": ariaLabel });

      // Warn about ambiguous link text
      if (typeof children === "string") {
        const ambiguousText = ["click here", "here", "read more", "more", "learn more", "view"];

        const text = children.toLowerCase().trim();
        if (ambiguousText.includes(text)) {
          console.warn(
            `[a11y] Link has ambiguous text: "${children}". ` +
              "Use descriptive text that makes sense out of context.",
            "\nLink href:",
            props.href,
          );
        }
      }
    }, [children, ariaLabel, props.href, suppressA11yWarnings]);

    return (
      <NextLink ref={ref} aria-label={ariaLabel} {...props}>
        {children}
      </NextLink>
    );
  },
);

Link.displayName = "EnhancedLink";
