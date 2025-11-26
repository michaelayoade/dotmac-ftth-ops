/**
 * CardSkeleton Component
 *
 * Provides skeleton loading states for card components.
 * Supports various card layouts including metrics, info cards, and content cards.
 */

import React from "react";
import { clsx } from "clsx";

export interface CardSkeletonProps {
  /**
   * Card variant
   * @default "default"
   */
  variant?: "default" | "metric" | "info" | "detailed" | "compact";

  /**
   * Show header section
   * @default true
   */
  showHeader?: boolean;

  /**
   * Show footer section
   * @default false
   */
  showFooter?: boolean;

  /**
   * Show icon/avatar
   * @default false
   */
  showIcon?: boolean;

  /**
   * Number of content lines
   * @default 3
   */
  contentLines?: number;

  /**
   * Card height (if fixed)
   */
  height?: string;

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
 * Used for dashboard KPIs and metrics
 */
function MetricCardSkeleton({ showIcon }: { showIcon: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <SkeletonBox className="h-4 w-24" />
          <SkeletonBox className="h-8 w-20" />
        </div>
        {showIcon && <SkeletonBox className="h-10 w-10 rounded-lg" />}
      </div>
      <SkeletonBox className="h-3 w-32" />
    </div>
  );
}

/**
 * Info card skeleton
 * Used for displaying information blocks
 */
function InfoCardSkeleton({
  showHeader,
  showIcon,
  contentLines,
}: {
  showHeader: boolean;
  showIcon: boolean;
  contentLines: number;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
      {showHeader && (
        <div className="flex items-center gap-3">
          {showIcon && <SkeletonBox className="h-12 w-12 rounded-full" />}
          <div className="flex-1 space-y-2">
            <SkeletonBox className="h-5 w-32" />
            <SkeletonBox className="h-3 w-48" />
          </div>
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: contentLines }).map((_, i) => (
          <SkeletonBox
            key={i}
            className={clsx("h-4", i === contentLines - 1 ? "w-3/4" : "w-full")}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Detailed card skeleton
 * Used for cards with rich content
 */
function DetailedCardSkeleton({
  showHeader,
  showFooter,
  showIcon,
  contentLines,
}: {
  showHeader: boolean;
  showFooter: boolean;
  showIcon: boolean;
  contentLines: number;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {/* Image/Banner */}
      <SkeletonBox className="h-48 w-full rounded-none" />

      <div className="p-6 space-y-4">
        {/* Header */}
        {showHeader && (
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <SkeletonBox className="h-6 w-48" />
              <SkeletonBox className="h-4 w-32" />
            </div>
            {showIcon && <SkeletonBox className="h-8 w-8 rounded" />}
          </div>
        )}

        {/* Content */}
        <div className="space-y-2">
          {Array.from({ length: contentLines }).map((_, i) => (
            <SkeletonBox
              key={i}
              className={clsx("h-4", i === contentLines - 1 ? "w-2/3" : "w-full")}
            />
          ))}
        </div>

        {/* Tags/Badges */}
        <div className="flex gap-2">
          <SkeletonBox className="h-6 w-16 rounded-full" />
          <SkeletonBox className="h-6 w-20 rounded-full" />
          <SkeletonBox className="h-6 w-14 rounded-full" />
        </div>

        {/* Footer */}
        {showFooter && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <SkeletonBox className="h-4 w-24" />
            <div className="flex gap-2">
              <SkeletonBox className="h-8 w-20" />
              <SkeletonBox className="h-8 w-20" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact card skeleton
 * Used for list items or compact views
 */
function CompactCardSkeleton({ showIcon }: { showIcon: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center gap-3">
        {showIcon && <SkeletonBox className="h-10 w-10 rounded" />}
        <div className="flex-1 space-y-2">
          <SkeletonBox className="h-4 w-32" />
          <SkeletonBox className="h-3 w-48" />
        </div>
        <SkeletonBox className="h-8 w-8 rounded" />
      </div>
    </div>
  );
}

/**
 * Default card skeleton
 */
function DefaultCardSkeleton({
  showHeader,
  showFooter,
  contentLines,
  height,
}: {
  showHeader: boolean;
  showFooter: boolean;
  contentLines: number;
  height?: string;
}) {
  return (
    <div className={clsx("bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4", height)}>
      {showHeader && (
        <div className="space-y-2">
          <SkeletonBox className="h-6 w-40" />
          <SkeletonBox className="h-4 w-56" />
        </div>
      )}

      <div className="space-y-2">
        {Array.from({ length: contentLines }).map((_, i) => (
          <SkeletonBox
            key={i}
            className={clsx("h-4", i === contentLines - 1 ? "w-3/4" : "w-full")}
          />
        ))}
      </div>

      {showFooter && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <SkeletonBox className="h-4 w-28" />
            <SkeletonBox className="h-9 w-24" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * CardSkeleton Component
 *
 * @example
 * ```tsx
 * <CardSkeleton variant="metric" showIcon />
 * ```
 *
 * @example Info card
 * ```tsx
 * <CardSkeleton
 *   variant="info"
 *   showHeader
 *   showIcon
 *   contentLines={4}
 * />
 * ```
 *
 * @example Grid of metric cards
 * ```tsx
 * <div className="grid grid-cols-4 gap-4">
 *   {[...Array(4)].map((_, i) => (
 *     <CardSkeleton key={i} variant="metric" showIcon />
 *   ))}
 * </div>
 * ```
 */
export function CardSkeleton({
  variant = "default",
  showHeader = true,
  showFooter = false,
  showIcon = false,
  contentLines = 3,
  height,
  className,
}: CardSkeletonProps) {
  const commonProps = {
    showHeader,
    showFooter,
    showIcon,
    contentLines,
  };

  return (
    <div className={className}>
      {variant === "metric" && <MetricCardSkeleton showIcon={showIcon} />}
      {variant === "info" && <InfoCardSkeleton {...commonProps} />}
      {variant === "detailed" && <DetailedCardSkeleton {...commonProps} />}
      {variant === "compact" && <CompactCardSkeleton showIcon={showIcon} />}
      {variant === "default" && (
        <DefaultCardSkeleton {...commonProps} {...(height !== undefined ? { height } : {})} />
      )}
    </div>
  );
}

/**
 * CardGrid Skeleton
 * Renders a grid of card skeletons
 */
export interface CardGridSkeletonProps {
  /**
   * Number of cards
   * @default 6
   */
  count?: number;

  /**
   * Grid columns
   * @default 3
   */
  columns?: 2 | 3 | 4;

  /**
   * Card variant
   * @default "default"
   */
  variant?: CardSkeletonProps["variant"];

  /**
   * Props to pass to each card
   */
  cardProps?: Omit<CardSkeletonProps, "variant" | "className">;

  /**
   * Custom className for grid container
   */
  className?: string;
}

/**
 * CardGridSkeleton Component
 *
 * @example
 * ```tsx
 * <CardGridSkeleton count={6} columns={3} variant="metric" />
 * ```
 */
export function CardGridSkeleton({
  count = 6,
  columns = 3,
  variant = "default",
  cardProps,
  className,
}: CardGridSkeletonProps) {
  const gridCols = columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-4";

  return (
    <div className={clsx("grid gap-4", gridCols, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} variant={variant} {...cardProps} />
      ))}
    </div>
  );
}

/**
 * Preset card skeletons for common use cases
 */
export const CardSkeletons = {
  /**
   * Metric card for KPIs
   */
  Metric: () => <CardSkeleton variant="metric" showIcon />,

  /**
   * Info card with header
   */
  Info: () => <CardSkeleton variant="info" showHeader showIcon contentLines={4} />,

  /**
   * Detailed content card
   */
  Detailed: () => <CardSkeleton variant="detailed" showHeader showFooter />,

  /**
   * Compact list item
   */
  Compact: () => <CardSkeleton variant="compact" showIcon />,

  /**
   * Grid of metric cards
   */
  MetricGrid: () => (
    <CardGridSkeleton count={4} columns={4} variant="metric" cardProps={{ showIcon: true }} />
  ),

  /**
   * Grid of info cards
   */
  InfoGrid: () => (
    <CardGridSkeleton
      count={6}
      columns={3}
      variant="info"
      cardProps={{ showHeader: true, showIcon: true }}
    />
  ),
};
