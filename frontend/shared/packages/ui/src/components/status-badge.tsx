/**
 * Reusable StatusBadge component
 * Used across the application for consistent status display
 * Supports dark mode and various status types
 */

import { cn } from "../lib/utils";

export type StatusVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "pending"
  | "active"
  | "inactive"
  | "suspended"
  | "terminated"
  | "paid"
  | "unpaid"
  | "overdue"
  | "draft"
  | "published"
  | "archived"
  | "default";

interface StatusBadgeProps {
  /**
   * The status text to display
   */
  children: React.ReactNode;

  /**
   * Visual variant of the badge
   * Maps to predefined color schemes
   */
  variant?: StatusVariant;

  /**
   * Optional custom className for additional styling
   */
  className?: string;

  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";

  /**
   * Show a dot indicator
   */
  showDot?: boolean;
}

// Dark mode uses *-300 instead of *-400 for yellow/orange/gray to meet WCAG AA contrast (4.5:1)
const variantStyles: Record<StatusVariant, string> = {
  success:
    "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 border-green-200 dark:border-green-800/30",
  warning:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/30",
  error:
    "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300 border-red-200 dark:border-red-800/30",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300 border-blue-200 dark:border-blue-800/30",
  pending:
    "bg-orange-100 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300 border-orange-200 dark:border-orange-800/30",
  active:
    "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 border-green-200 dark:border-green-800/30",
  inactive:
    "bg-gray-100 text-gray-800 dark:bg-gray-950/30 dark:text-gray-300 border-gray-200 dark:border-gray-700/30",
  suspended:
    "bg-orange-100 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300 border-orange-200 dark:border-orange-800/30",
  terminated:
    "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300 border-red-200 dark:border-red-800/30",
  paid: "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 border-green-200 dark:border-green-800/30",
  unpaid:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/30",
  overdue:
    "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300 border-red-200 dark:border-red-800/30",
  draft:
    "bg-gray-100 text-gray-800 dark:bg-gray-950/30 dark:text-gray-300 border-gray-200 dark:border-gray-700/30",
  published:
    "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300 border-blue-200 dark:border-blue-800/30",
  archived:
    "bg-gray-100 text-gray-800 dark:bg-gray-950/30 dark:text-gray-300 border-gray-200 dark:border-gray-700/30",
  default: "bg-muted text-muted-foreground border-border",
};

const sizeStyles = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-1",
  lg: "text-base px-3 py-1.5",
};

const dotStyles: Record<StatusVariant, string> = {
  success: "bg-green-600 dark:bg-green-400",
  warning: "bg-yellow-600 dark:bg-yellow-300",
  error: "bg-red-600 dark:bg-red-400",
  info: "bg-blue-600 dark:bg-blue-400",
  pending: "bg-orange-600 dark:bg-orange-300",
  active: "bg-green-600 dark:bg-green-400",
  inactive: "bg-gray-600 dark:bg-gray-400",
  suspended: "bg-orange-600 dark:bg-orange-300",
  terminated: "bg-red-600 dark:bg-red-400",
  paid: "bg-green-600 dark:bg-green-400",
  unpaid: "bg-yellow-600 dark:bg-yellow-300",
  overdue: "bg-red-600 dark:bg-red-400",
  draft: "bg-gray-600 dark:bg-gray-400",
  published: "bg-blue-600 dark:bg-blue-400",
  archived: "bg-gray-600 dark:bg-gray-400",
  default: "bg-muted-foreground",
};

export function StatusBadge({
  children,
  variant = "default",
  className,
  size = "md",
  showDot = false,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      role="status"
      aria-label={`Status: ${children}`}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotStyles[variant])} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

/**
 * Helper function to automatically determine variant from status string
 * Usage: <StatusBadge variant={getStatusVariant(status)}>{status}</StatusBadge>
 */
export function getStatusVariant(status: string): StatusVariant {
  const normalizedStatus = status.toLowerCase().trim();

  // Map common status strings to variants
  const statusMap: Record<string, StatusVariant> = {
    // Payment statuses
    paid: "paid",
    unpaid: "unpaid",
    overdue: "overdue",
    pending: "pending",

    // General statuses
    active: "active",
    inactive: "inactive",
    suspended: "suspended",
    terminated: "terminated",

    // Content statuses
    draft: "draft",
    published: "published",
    archived: "archived",

    // Result statuses
    success: "success",
    completed: "success",
    approved: "success",
    failed: "error",
    rejected: "error",
    error: "error",
    warning: "warning",
    info: "info",
  };

  return statusMap[normalizedStatus] || "default";
}
