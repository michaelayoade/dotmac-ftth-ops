/**
 * Portal-Aware Card Component
 *
 * Card component that adapts styling based on current portal
 * Includes portal-specific animations and spacing
 */

"use client";

import * as React from "react";

import { usePortalTheme } from "../lib/design-system/portal-themes";
import { cn } from "../lib/utils";

export interface PortalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Enable hover effect */
  hoverable?: boolean;
  /** Enable click interaction */
  interactive?: boolean;
  /** Portal-specific animation variant */
  variant?: "default" | "elevated" | "outlined" | "flat";
}

const PortalCard = React.forwardRef<HTMLDivElement, PortalCardProps>(
  ({ className, hoverable = false, interactive = false, variant = "default", ...props }, ref) => {
    const { theme } = usePortalTheme();
    const { animations } = theme;

    const variantClasses = {
      default: "bg-card text-card-foreground border shadow-sm",
      elevated: "bg-card text-card-foreground shadow-lg",
      outlined: "bg-transparent border-2 border-portal-primary/20",
      flat: "bg-card text-card-foreground",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg",
          variantClasses[variant],
          hoverable && "transition-all hover:shadow-md",
          interactive && "cursor-pointer transition-all hover:shadow-md active:scale-[0.99]",
          className,
        )}
        style={{
          transitionDuration: `${animations.duration}ms`,
          transitionTimingFunction: animations.easing,
        }}
        {...props}
      />
    );
  },
);
PortalCard.displayName = "PortalCard";

const PortalCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { theme } = usePortalTheme();

    return (
      <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5", className)}
        style={{
          padding: theme.spacing.componentGap,
        }}
        {...props}
      />
    );
  },
);
PortalCardHeader.displayName = "PortalCardHeader";

const PortalCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => {
  const { theme } = usePortalTheme();

  return (
    <h3
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      style={{
        fontSize: theme.fontSize.lg[0],
        lineHeight: theme.fontSize.lg[1].lineHeight,
      }}
      {...props}
    >
      {children}
    </h3>
  );
});
PortalCardTitle.displayName = "PortalCardTitle";

const PortalCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { theme } = usePortalTheme();

  return (
    <p
      ref={ref}
      className={cn("text-muted-foreground", className)}
      style={{
        fontSize: theme.fontSize.sm[0],
        lineHeight: theme.fontSize.sm[1].lineHeight,
      }}
      {...props}
    />
  );
});
PortalCardDescription.displayName = "PortalCardDescription";

const PortalCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { theme } = usePortalTheme();

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          padding: theme.spacing.componentGap,
          paddingTop: 0,
        }}
        {...props}
      />
    );
  },
);
PortalCardContent.displayName = "PortalCardContent";

const PortalCardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { theme } = usePortalTheme();

    return (
      <div
        ref={ref}
        className={cn("flex items-center", className)}
        style={{
          padding: theme.spacing.componentGap,
          paddingTop: 0,
        }}
        {...props}
      />
    );
  },
);
PortalCardFooter.displayName = "PortalCardFooter";

export {
  PortalCard,
  PortalCardHeader,
  PortalCardFooter,
  PortalCardTitle,
  PortalCardDescription,
  PortalCardContent,
};
