/**
 * Card Primitive Component
 *
 * Enhanced card component with comprehensive TypeScript support,
 * accessibility features, and flexible composition patterns
 */

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { forwardRef } from "react";

const cardVariants = cva(
  "relative rounded-lg border bg-card text-card-foreground shadow-sm transition-colors",
  {
    variants: {
      variant: {
        default: "border-border",
        outline: "border-border bg-background",
        filled: "border-transparent bg-muted",
        elevated: "border-border shadow-lg",
        ghost: "border-transparent bg-transparent shadow-none",
      },
      padding: {
        none: "p-0",
        sm: "p-3",
        default: "p-6",
        lg: "p-8",
      },
      interactive: {
        true: "cursor-pointer hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "default",
      interactive: false,
    },
  },
);

const cardHeaderVariants = cva("flex flex-col space-y-1.5", {
  variants: {
    padding: {
      none: "p-0",
      sm: "p-3",
      default: "p-6",
      lg: "p-8",
    },
  },
  defaultVariants: {
    padding: "default",
  },
});

const cardTitleVariants = cva("text-2xl font-semibold leading-none tracking-tight");

const cardDescriptionVariants = cva("text-sm text-muted-foreground");

const cardContentVariants = cva("", {
  variants: {
    padding: {
      none: "p-0",
      sm: "p-3 pt-0",
      default: "p-6 pt-0",
      lg: "p-8 pt-0",
    },
  },
  defaultVariants: {
    padding: "default",
  },
});

const cardFooterVariants = cva("flex items-center", {
  variants: {
    padding: {
      none: "p-0",
      sm: "p-3 pt-0",
      default: "p-6 pt-0",
      lg: "p-8 pt-0",
    },
  },
  defaultVariants: {
    padding: "default",
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
  /** Whether the card is in a loading state */
  isLoading?: boolean;
  /** Loading component to show */
  loadingComponent?: React.ReactNode;
  /** Whether to show loading overlay */
  showLoadingOverlay?: boolean;
}

export interface CardHeaderProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardHeaderVariants> {
  asChild?: boolean;
}

export interface CardTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof cardTitleVariants> {
  /** Heading level for accessibility */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  asChild?: boolean;
}

export interface CardDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof cardDescriptionVariants> {
  asChild?: boolean;
}

export interface CardContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardContentVariants> {
  asChild?: boolean;
}

export interface CardFooterProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardFooterVariants> {
  asChild?: boolean;
}

// Main Card Component
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant,
      padding,
      interactive,
      asChild = false,
      isLoading = false,
      loadingComponent,
      showLoadingOverlay = false,
      children,
      onClick,
      onKeyDown,
      tabIndex,
      role,
      "aria-label": ariaLabel,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "div";

    // Handle interactive behavior
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (interactive && onClick && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onClick(e as any);
      }
      onKeyDown?.(e);
    };

    // Accessibility props for interactive cards
    const interactiveAttributes = interactive
      ? {
          tabIndex: tabIndex ?? 0,
          role: role ?? "button",
          "aria-label": ariaLabel,
          onKeyDown: handleKeyDown,
        }
      : {
          tabIndex,
          role,
          "aria-label": ariaLabel,
          onKeyDown,
        };

    const content = (
      <>
        {isLoading && showLoadingOverlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-background/50">
            <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {isLoading && loadingComponent ? loadingComponent : children}
      </>
    );

    return (
      <Comp
        ref={ref}
        className={clsx(cardVariants({ variant, padding, interactive, className }))}
        onClick={onClick}
        {...interactiveAttributes}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
Card.displayName = "Card";

// Card Header Component
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, padding, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp ref={ref} className={clsx(cardHeaderVariants({ padding, className }))} {...props} />
    );
  },
);
CardHeader.displayName = "CardHeader";

// Card Title Component
export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, level = 3, children, asChild = false, ...props }, ref) => {
    const headingLevel = Math.min(Math.max(level, 1), 6);
    type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    const Tag = `h${headingLevel}` as HeadingTag;

    if (asChild) {
      return (
        <Slot className={clsx(cardTitleVariants(), className)} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <Tag ref={ref} className={clsx(cardTitleVariants(), className)} {...props}>
        {children}
      </Tag>
    );
  },
);
CardTitle.displayName = "CardTitle";

// Card Description Component
export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, asChild = false, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={clsx(cardDescriptionVariants(), className)} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <p ref={ref} className={clsx(cardDescriptionVariants(), className)} {...props}>
        {children}
      </p>
    );
  },
);
CardDescription.displayName = "CardDescription";

// Card Content Component
export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, padding, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp ref={ref} className={clsx(cardContentVariants({ padding, className }))} {...props} />
    );
  },
);
CardContent.displayName = "CardContent";

// Card Footer Component
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, padding, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp ref={ref} className={clsx(cardFooterVariants({ padding, className }))} {...props} />
    );
  },
);
CardFooter.displayName = "CardFooter";

export {
  cardVariants,
  cardHeaderVariants,
  cardTitleVariants,
  cardDescriptionVariants,
  cardContentVariants,
  cardFooterVariants,
};
