/**
 * Reusable PageHeader component
 * Provides consistent page header layout across the application
 * Supports dark mode and flexible action buttons
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";

interface PageHeaderProps {
  /**
   * Page title
   */
  title: string;

  /**
   * Optional subtitle/description
   */
  description?: string;

  /**
   * Optional icon to display before title
   */
  icon?: LucideIcon;

  /**
   * Action buttons or elements to display on the right
   */
  actions?: ReactNode;

  /**
   * Additional content below title/description
   */
  children?: ReactNode;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Whether to show a bottom border
   */
  showBorder?: boolean;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  showBorder = false,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6", showBorder && "pb-6 border-b border-border", className)}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex-shrink-0">
                <Icon className="h-8 w-8 text-primary" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold text-foreground truncate">{title}</h1>
              {description && (
                <p className="text-muted-foreground mt-1 text-sm sm:text-base">{description}</p>
              )}
            </div>
          </div>
        </div>

        {actions && <div className="flex-shrink-0 flex items-start gap-2">{actions}</div>}
      </div>

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/**
 * PageHeader.Actions - Wrapper for action buttons with consistent spacing
 */
PageHeader.Actions = function PageHeaderActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex items-center gap-2 flex-wrap", className)}>{children}</div>;
};

/**
 * PageHeader.Stat - Display statistics in the header
 */
PageHeader.Stat = function PageHeaderStat({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 bg-accent rounded-lg", className)}>
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
};

/**
 * PageHeader.Breadcrumb - Display breadcrumb navigation
 */
PageHeader.Breadcrumb = function PageHeaderBreadcrumb({
  items,
  className,
}: {
  items: Array<{ label: string; href?: string }>;
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-2 text-sm mb-2", className)}>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && (
            <span className="text-muted-foreground" aria-hidden="true">
              /
            </span>
          )}
          {item.href ? (
            <a
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
};
