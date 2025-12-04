/**
 * Button Primitive Component
 *
 * Enhanced base button component with comprehensive TypeScript support,
 * accessibility features, loading states, and security considerations
 */

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import * as React from "react";
import { Loader2 } from "lucide-react";

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" &&
  value !== null &&
  "then" in value &&
  typeof (value as Promise<unknown>).then === "function";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Base variants
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",

        // Portal-specific variants
        admin:
          "bg-blue-600 text-white shadow hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        customer:
          "bg-green-600 text-white shadow hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
        reseller:
          "bg-purple-600 text-white shadow hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2",
        technician:
          "bg-orange-600 text-white shadow hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2",
        management:
          "bg-slate-800 text-white shadow hover:bg-slate-900 focus:ring-2 focus:ring-slate-600 focus:ring-offset-2",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        xl: "h-12 rounded-md px-10 text-base",
        icon: "h-9 w-9",
      },
      loading: {
        true: "cursor-not-allowed opacity-70",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Whether the button is in a loading state */
  isLoading?: boolean;
  /** Text to display during loading state */
  loadingText?: string;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Icon to display on the left */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right */
  rightIcon?: React.ReactNode;
  /** Icon to display (uses leftIcon by default, rightIcon if iconPosition is 'right') */
  icon?: React.ReactNode;
  /** Position of the icon */
  iconPosition?: "left" | "right";
  /** Whether to prevent form submission */
  preventFormSubmission?: boolean;
  /** Custom click handler with security considerations */
  onSecureClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  /** Whether to show loading state during async operations */
  showAsyncLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      loading = false,
      loadingText,
      loadingComponent,
      leftIcon,
      rightIcon,
      icon,
      iconPosition = "left",
      preventFormSubmission = false,
      onSecureClick,
      showAsyncLoading = true,
      disabled,
      onClick,
      onKeyDown,
      type = "button",
      children,
      ...props
    },
    ref,
  ) => {
    const [isAsyncLoading, setIsAsyncLoading] = React.useState(false);
    const Comp = asChild ? Slot : "button";

    // Use only isLoading - no backward compatibility
    const actuallyLoading = isLoading;

    // Handle icon props (icon prop can override leftIcon/rightIcon based on position)
    const resolvedLeftIcon = icon && iconPosition === "left" ? icon : leftIcon;
    const resolvedRightIcon = icon && iconPosition === "right" ? icon : rightIcon;

    // Determine if button should be disabled
    const isButtonDisabled = disabled || actuallyLoading || isAsyncLoading;

    // Handle click with security and async considerations
    const handleClick = React.useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        // Prevent form submission if requested
        if (preventFormSubmission) {
          event.preventDefault();
        }

        if (showAsyncLoading && isAsyncLoading) {
          return;
        }

        // Handle secure click if provided
        if (onSecureClick) {
          if (showAsyncLoading) {
            setIsAsyncLoading(true);
          }

          try {
            await onSecureClick(event);
          } catch (error) {
            console.error("Secure click handler error:", error);
          } finally {
            if (showAsyncLoading) {
              setIsAsyncLoading(false);
            }
          }
          return;
        }

        // Standard click handler
        if (onClick) {
          if (showAsyncLoading) {
            setIsAsyncLoading(true);
            try {
              const result = onClick(event);
              if (isPromise(result)) {
                await result;
              }
            } catch (error) {
              console.error("Click handler error:", error);
            } finally {
              setIsAsyncLoading(false);
            }
          } else {
            onClick(event);
          }
        }
      },
      [isAsyncLoading, onClick, onSecureClick, preventFormSubmission, showAsyncLoading],
    );

    // Determine what to show inside button
    const showLoading = actuallyLoading || isAsyncLoading;

    // Custom loading spinner matching UI package behavior
    const LoadingIcon = loadingComponent || (
      <svg
        data-testid="loader"
        className="animate-spin h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    const handleKeyDownEvent = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if ([" ", "Spacebar", "Space"].includes(event.key)) {
        event.preventDefault();
        event.currentTarget.click();
      }
    };

    // When using asChild, pass only children to avoid Slot conflicts
    if (asChild) {
      return (
        <Comp
          className={clsx(buttonVariants({ variant, size, className }))}
          ref={ref}
          disabled={disabled} // Don't modify disabled when asChild
          type={type}
          onClick={onClick} // Use original onClick when asChild
          onKeyDown={onKeyDown}
          aria-disabled={disabled ? "true" : undefined}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    // Content rendering logic matching UI package behavior
    const renderContent = () => {
      if (showLoading) {
        return (
          <>
            {LoadingIcon}
            {loadingText && <span>{loadingText}</span>}
          </>
        );
      }

      if (resolvedLeftIcon) {
        return (
          <>
            {resolvedLeftIcon}
            {children}
          </>
        );
      }

      if (resolvedRightIcon) {
        return (
          <>
            {children}
            {resolvedRightIcon}
          </>
        );
      }

      return children;
    };

    return (
      <Comp
        className={clsx(buttonVariants({ variant, size, loading: showLoading, className }))}
        ref={ref}
        disabled={isButtonDisabled}
        type={type}
        onClick={handleClick}
        onKeyDown={(event: React.KeyboardEvent<HTMLButtonElement>) => {
          onKeyDown?.(event);
          handleKeyDownEvent(event);
        }}
        aria-disabled={isButtonDisabled ? "true" : undefined}
        {...props}
      >
        {renderContent()}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
