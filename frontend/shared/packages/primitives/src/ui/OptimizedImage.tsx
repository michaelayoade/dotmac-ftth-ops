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
  ({ src, alt, width, height, priority = false, className, onLoadStart, role, ...props }, ref) => {
    const internalRef = React.useRef<HTMLImageElement | null>(null);
    const setRefs = React.useCallback(
      (node: HTMLImageElement | null) => {
        internalRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLImageElement | null>).current = node;
        }
      },
      [ref],
    );

    React.useEffect(() => {
      const node = internalRef.current;
      if (!node || !onLoadStart) {
        return;
      }

      const handler = (event: Event) => {
        onLoadStart(event as unknown as React.SyntheticEvent<HTMLImageElement>);
      };

      node.addEventListener("loadstart", handler);
      return () => node.removeEventListener("loadstart", handler);
    }, [onLoadStart]);

    // Enhanced fallback img with optimization attributes
    // Note: Next.js Image should be used in Next.js apps, this is a fallback
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={setRefs}
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        role={role ?? "img"}
        {...props}
      />
    );
  },
);

OptimizedImage.displayName = "OptimizedImage";
