/**
 * Enhanced Image Component
 *
 * Wrapper for Next.js Image with accessibility warnings
 */

"use client";

import { warnMissingAlt } from "@dotmac/utils/a11y-dev-warnings";
import NextImage, { type ImageProps as NextImageProps } from "next/image";
import * as React from "react";

export interface EnhancedImageProps extends NextImageProps {
  /**
   * Mark image as decorative (will use alt="")
   * Use for images that don't convey meaningful information
   */
  decorative?: boolean;
  /** Suppress accessibility warnings */
  suppressA11yWarnings?: boolean;
}

/**
 * Image with built-in accessibility checks
 *
 * Development warnings for:
 * - Missing alt text
 * - Empty alt without decorative flag
 *
 * @example
 * ```tsx
 * // ✅ Good: Descriptive alt text
 * <Image src="/logo.png" alt="Company Logo" width={100} height={100} />
 *
 * // ✅ Good: Decorative image
 * <Image src="/divider.png" decorative width={100} height={10} />
 *
 * // ⚠️ Warning: Missing alt text
 * <Image src="/photo.jpg" width={100} height={100} />
 *
 * // ⚠️ Warning: Empty alt without decorative flag
 * <Image src="/icon.png" alt="" width={20} height={20} />
 * ```
 */
export const Image = React.forwardRef<HTMLImageElement, EnhancedImageProps>(
  ({ alt, decorative, suppressA11yWarnings, ...props }, ref) => {
    // Development-time accessibility checks
    React.useEffect(() => {
      if (suppressA11yWarnings) return;

      // Check for missing alt
      warnMissingAlt(props.src?.toString(), alt, decorative);

      // Warn if empty alt without decorative flag
      if (alt === "" && !decorative) {
        console.warn(
          "[a11y] Image has empty alt text without decorative flag. " +
            "If image is decorative, use decorative prop. " +
            "Otherwise, provide descriptive alt text.",
          "\nImage src:",
          props.src,
        );
      }
    }, [alt, decorative, props.src, suppressA11yWarnings]);

    // Use empty alt for decorative images
    const altText = decorative ? "" : alt;

    return <NextImage ref={ref} alt={altText || ""} {...props} />;
  },
);

Image.displayName = "EnhancedImage";
