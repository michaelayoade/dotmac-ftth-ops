/**
 * Reusable EmptyState component
 * Displays consistent empty state UI across the application
 * Supports dark mode and various use cases
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";

import { Button } from "./button";

interface EmptyStateProps {
  /**
   * Icon to display
   */
  icon?: LucideIcon;

  /**
   * Title text
   */
  title: string;

  /**
   * Description text or element
   */
  description?: ReactNode;

  /**
   * Primary action button
   */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };

  /**
   * Secondary action button
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };

  /**
   * Custom content to render below description
   */
  children?: ReactNode;

  /**
   * Custom className
   */
  className?: string;

  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: {
    container: "py-8",
    icon: "h-8 w-8",
    title: "text-base",
    description: "text-sm",
  },
  md: {
    container: "py-12",
    icon: "h-12 w-12",
    title: "text-lg",
    description: "text-base",
  },
  lg: {
    container: "py-16",
    icon: "h-16 w-16",
    title: "text-xl",
    description: "text-lg",
  },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  children,
  className,
  size = "md",
}: EmptyStateProps) {
  const styles = sizeStyles[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        styles.container,
        className,
      )}
      role="status"
      aria-label={title}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-accent p-3">
          <Icon className={cn(styles.icon, "text-muted-foreground")} aria-hidden="true" />
        </div>
      )}

      <h3 className={cn("font-semibold text-foreground mb-2", styles.title)}>{title}</h3>

      {description && (
        <p className={cn("text-muted-foreground max-w-md mb-6", styles.description)}>
          {description}
        </p>
      )}

      {children}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-6">
          {action && (
            <Button onClick={action.onClick} size={size === "sm" ? "sm" : "default"}>
              {action.icon && <action.icon className="h-4 w-4 mr-2" />}
              {action.label}
            </Button>
          )}

          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="outline"
              size={size === "sm" ? "sm" : "default"}
            >
              {secondaryAction.icon && <secondaryAction.icon className="h-4 w-4 mr-2" />}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * EmptyState.List - For empty lists/tables
 */
EmptyState.List = function EmptyStateList({
  entityName,
  onCreateClick,
  createLabel,
  icon: Icon,
  className,
}: {
  entityName: string;
  onCreateClick?: () => void;
  createLabel?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  const iconProps = Icon ? { icon: Icon } : {};
  const actionProps = onCreateClick
    ? {
        action: {
          label: createLabel || `Create ${entityName}`,
          onClick: onCreateClick,
        },
      }
    : {};

  return (
    <EmptyState
      {...iconProps}
      {...actionProps}
      title={`No ${entityName} found`}
      description={`Get started by creating your first ${entityName.toLowerCase()}.`}
      {...(className ? { className } : {})}
    />
  );
};

/**
 * EmptyState.Search - For empty search results
 */
EmptyState.Search = function EmptyStateSearch({
  searchTerm,
  onClearSearch,
  icon: Icon,
  className,
}: {
  searchTerm?: string;
  onClearSearch?: () => void;
  icon?: LucideIcon;
  className?: string;
}) {
  const iconProps = Icon ? { icon: Icon } : {};
  const actionProps = onClearSearch
    ? {
        action: {
          label: "Clear search",
          onClick: onClearSearch,
        },
      }
    : {};

  return (
    <EmptyState
      {...iconProps}
      {...actionProps}
      title="No results found"
      description={
        searchTerm ? (
          <>
            We couldn&apos;t find anything matching &quot;{searchTerm}&quot;. Try adjusting your
            search.
          </>
        ) : (
          "Try adjusting your filters or search criteria."
        )
      }
      size="sm"
      {...(className ? { className } : {})}
    />
  );
};

/**
 * EmptyState.Error - For error states
 */
EmptyState.Error = function EmptyStateError({
  title = "Something went wrong",
  description = "We encountered an error loading this content. Please try again.",
  onRetry,
  retryLabel = "Try again",
  icon: Icon,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  const iconProps = Icon ? { icon: Icon } : {};
  const actionProps = onRetry
    ? {
        action: {
          label: retryLabel,
          onClick: onRetry,
        },
      }
    : {};

  return (
    <EmptyState
      {...iconProps}
      {...actionProps}
      title={title}
      description={description}
      {...(className ? { className } : {})}
    />
  );
};
