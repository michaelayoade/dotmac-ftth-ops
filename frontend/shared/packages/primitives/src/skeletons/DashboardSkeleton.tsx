/**
 * DashboardSkeleton Component
 *
 * Provides skeleton loading states for dashboard pages.
 * Supports multiple layout variants for different dashboard types.
 */

import React from "react";
import { clsx } from "clsx";

export interface DashboardSkeletonProps {
  /**
   * Layout variant for different dashboard types
   * @default "default"
   */
  variant?: "default" | "metrics" | "network" | "compact";

  /**
   * Number of metric cards to show
   * @default 4
   */
  metricCards?: number;

  /**
   * Show header section
   * @default true
   */
  showHeader?: boolean;

  /**
   * Number of content sections to show
   * @default 2
   */
  contentSections?: number;

  /**
   * Custom className for container
   */
  className?: string;
}

/**
 * Base skeleton box component
 */
function SkeletonBox({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("bg-gray-200 dark:bg-gray-700 rounded animate-pulse", className)}
      {...props}
    />
  );
}

/**
 * Metric card skeleton
 */
function MetricCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-3">
      <SkeletonBox className="h-4 w-20" />
      <SkeletonBox className="h-8 w-16" />
      <SkeletonBox className="h-3 w-24" />
    </div>
  );
}

/**
 * Dashboard header skeleton
 */
function DashboardHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <SkeletonBox className="h-8 w-48" />
        <SkeletonBox className="h-4 w-64" />
      </div>
      <div className="flex gap-2">
        <SkeletonBox className="h-10 w-24" />
        <SkeletonBox className="h-10 w-24" />
      </div>
    </div>
  );
}

/**
 * Content section skeleton
 */
function ContentSectionSkeleton({ variant = "default" }: { variant?: string }) {
  if (variant === "network") {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <SkeletonBox className="h-6 w-32" />
        <div className="grid grid-cols-3 gap-4">
          <SkeletonBox className="h-32" />
          <SkeletonBox className="h-32" />
          <SkeletonBox className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
      <SkeletonBox className="h-6 w-40" />
      <SkeletonBox className="h-64" />
    </div>
  );
}

/**
 * DashboardSkeleton Component
 *
 * @example
 * ```tsx
 * <DashboardSkeleton variant="metrics" metricCards={4} />
 * ```
 *
 * @example With custom layout
 * ```tsx
 * <DashboardSkeleton
 *   variant="network"
 *   metricCards={6}
 *   contentSections={3}
 * />
 * ```
 */
export function DashboardSkeleton({
  variant = "default",
  metricCards = 4,
  showHeader = true,
  contentSections = 2,
  className,
}: DashboardSkeletonProps) {
  // Adjust metric cards based on variant
  const cardCount =
    variant === "network"
      ? Math.max(metricCards, 4)
      : variant === "compact"
        ? Math.min(metricCards, 3)
        : metricCards;

  // Adjust grid columns based on card count
  const gridCols =
    cardCount === 2
      ? "grid-cols-2"
      : cardCount === 3
        ? "grid-cols-3"
        : cardCount >= 4
          ? "grid-cols-4"
          : "grid-cols-1";

  return (
    <div className={clsx("space-y-6", className)}>
      {/* Header */}
      {showHeader && <DashboardHeaderSkeleton />}

      {/* Metric Cards */}
      {variant !== "compact" && (
        <div className={clsx("grid gap-4", gridCols)}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Content Sections */}
      {Array.from({ length: contentSections }).map((_, i) => (
        <ContentSectionSkeleton key={i} variant={variant} />
      ))}
    </div>
  );
}

/**
 * Preset dashboard skeletons for common use cases
 */
export const DashboardSkeletons = {
  /**
   * Network monitoring dashboard
   */
  Network: () => <DashboardSkeleton variant="network" metricCards={6} contentSections={2} />,

  /**
   * Metrics dashboard with cards
   */
  Metrics: () => <DashboardSkeleton variant="metrics" metricCards={4} contentSections={3} />,

  /**
   * Compact dashboard
   */
  Compact: () => <DashboardSkeleton variant="compact" metricCards={3} contentSections={1} />,

  /**
   * Default dashboard
   */
  Default: () => <DashboardSkeleton />,
};
