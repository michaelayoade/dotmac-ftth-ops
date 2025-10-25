/**
 * Portal-Aware Button Component
 *
 * Button component with portal-specific animations and hover effects
 */

"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { usePortalTheme } from "@/lib/design-system/portal-themes";
import { cn } from "@/lib/utils";

const portalButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-portal-primary text-white hover:opacity-90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border-2 border-portal-primary text-portal-primary bg-transparent hover:bg-portal-primary/10",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-portal-primary underline-offset-4 hover:underline",
        accent: "bg-portal-accent text-white hover:opacity-90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface PortalButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof portalButtonVariants> {}

const PortalButton = React.forwardRef<HTMLButtonElement, PortalButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    const { theme } = usePortalTheme();
    const { animations } = theme;

    return (
      <button
        className={cn(portalButtonVariants({ variant, size, className }))}
        ref={ref}
        style={{
          transitionDuration: `${animations.duration}ms`,
          transitionTimingFunction: animations.easing,
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
          if (!props.disabled) {
            e.currentTarget.style.transform = `scale(${animations.hoverScale})`;
          }
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        onMouseDown={(e: React.MouseEvent<HTMLButtonElement>) => {
          if (!props.disabled) {
            e.currentTarget.style.transform = `scale(${animations.activeScale})`;
          }
        }}
        onMouseUp={(e: React.MouseEvent<HTMLButtonElement>) => {
          if (!props.disabled) {
            e.currentTarget.style.transform = `scale(${animations.hoverScale})`;
          }
        }}
        {...props}
      />
    );
  },
);
PortalButton.displayName = "PortalButton";

export { PortalButton, portalButtonVariants };
