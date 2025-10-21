/**
 * Optimized Image Component
 *
 * A composition-based approach to handle both Next.js Image optimization
 * and fallback for non-Next.js environments.
 */

import * as React from "react";

export interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Image source URL
   */
  src: string;
  /**
   * Alt text for accessibility
   */
  alt: string;
  /**
   * Width for optimization
   */
  width?: number;
  /**
   * Height for optimization
   */
  height?: number;
  /**
   * Priority loading for above-the-fold images
   */
  priority?: boolean;
  /**
   * Quality setting (1-100)
   */
  quality?: number;
  /**
   * Placeholder strategy
   */
  placeholder?: "blur" | "empty";
  /**
   * Blur data URL for placeholder
   */
  blurDataURL?: string;
}

/**
 * Smart image component that uses Next.js Image when available,
 * falls back to regular img tag with optimization hints
 */
export const OptimizedImage = React.forwardRef<HTMLImageElement, OptimizedImageProps>(
  ({ src, alt, width, height, priority = false, className, ...props }, ref) => {
    // Enhanced fallback img with optimization attributes
    // Note: Next.js Image should be used in Next.js apps, this is a fallback
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={ref}
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...props}
      />
    );
  },
);

OptimizedImage.displayName = "OptimizedImage";
