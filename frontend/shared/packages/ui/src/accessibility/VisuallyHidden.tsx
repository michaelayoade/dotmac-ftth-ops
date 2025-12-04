/**
 * VisuallyHidden Component
 *
 * Hide content visually but keep it accessible to screen readers
 */

interface VisuallyHiddenProps {
  children: React.ReactNode;
  /** Whether to use span or div */
  as?: "span" | "div";
  /** Additional CSS classes */
  className?: string;
}

/**
 * VisuallyHidden - Hide content from visual users but keep for screen readers
 *
 * Uses the "sr-only" pattern (screen reader only)
 *
 * @example
 * ```tsx
 * <button>
 *   <Icon />
 *   <VisuallyHidden>Close dialog</VisuallyHidden>
 * </button>
 * ```
 */
export function VisuallyHidden({
  children,
  as: Component = "span",
  className,
}: VisuallyHiddenProps) {
  return (
    <Component
      className={`sr-only ${className || ""}`}
      style={{
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: 0,
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        borderWidth: 0,
      }}
    >
      {children}
    </Component>
  );
}
