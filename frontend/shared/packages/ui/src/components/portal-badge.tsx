/**
 * Portal Badge Component
 *
 * Visual indicator showing which portal the user is currently viewing
 * Uses portal theme colors and metadata
 */

"use client";

import { usePortalTheme } from "../lib/design-system/portal-themes";
import { cn } from "../lib/utils";

interface PortalBadgeProps {
  /** Show icon alongside text */
  showIcon?: boolean;
  /** Use short name instead of full name */
  shortName?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * Portal Badge - Shows current portal with color-coded indicator
 *
 * @example
 * ```tsx
 * // Default usage
 * <PortalBadge />
 *
 * // With icon and short name
 * <PortalBadge showIcon shortName size="sm" />
 * ```
 */
export function PortalBadge({
  showIcon = true,
  shortName = false,
  className,
  size = "md",
}: PortalBadgeProps) {
  const { theme } = usePortalTheme();
  const { metadata } = theme;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-sm gap-1.5",
    lg: "px-4 py-1.5 text-base gap-2",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-colors",
        "bg-portal-primary/10 text-portal-primary border border-portal-primary/20",
        sizeClasses[size],
        className,
      )}
      role="status"
      aria-label={`Current portal: ${metadata.name}`}
    >
      {showIcon && <span className="shrink-0">{metadata.icon}</span>}
      <span>{shortName ? metadata.shortName : metadata.name}</span>
    </div>
  );
}

/**
 * Portal Badge Compact - Minimal version with just icon
 */
export function PortalBadgeCompact({ className }: { className?: string }) {
  const { theme } = usePortalTheme();
  const { metadata } = theme;

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center w-8 h-8 rounded-full",
        "bg-portal-primary/10 text-portal-primary border border-portal-primary/20",
        "text-lg",
        className,
      )}
      role="status"
      aria-label={`Current portal: ${metadata.name}`}
      title={metadata.name}
    >
      {metadata.icon}
    </div>
  );
}

/**
 * Portal User Type Badge - Shows what type of user is expected in this portal
 */
export function PortalUserTypeBadge({ className }: { className?: string }) {
  const { theme } = usePortalTheme();
  const { metadata } = theme;

  return (
    <div
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium",
        "bg-muted text-muted-foreground border border-border",
        className,
      )}
      role="status"
      aria-label={`User type: ${metadata.userType}`}
    >
      <span className="mr-1.5">{metadata.icon}</span>
      <span>{metadata.userType}</span>
    </div>
  );
}

/**
 * Portal Indicator Dot - Subtle colored dot for navigation items
 */
export function PortalIndicatorDot({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full bg-portal-primary", className)}
      aria-hidden="true"
    />
  );
}
