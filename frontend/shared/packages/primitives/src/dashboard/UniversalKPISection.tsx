/**
 * Universal KPI Section Component
 * Displays key performance indicators in a grid layout with consistent styling
 */

"use client";

import { motion } from "framer-motion";
import { UniversalMetricCard } from "./UniversalMetricCard";
import type { UniversalMetricCardProps } from "./UniversalMetricCard";
import { cn } from "../utils/cn";

export interface KPIItem extends Omit<UniversalMetricCardProps, "size" | "variant"> {
  id: string;
}

export interface UniversalKPISectionProps {
  title?: string;
  subtitle?: string;
  kpis: KPIItem[];

  // Layout Options
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  responsiveColumns?: {
    sm?: 1 | 2;
    md?: 2 | 3 | 4;
    lg?: 3 | 4 | 5 | 6;
    xl?: 4 | 5 | 6;
  };
  gap?: "tight" | "normal" | "relaxed";

  // Card Options
  cardSize?: "sm" | "md" | "lg";
  cardVariant?: "default" | "compact" | "featured";

  // Section Styling
  className?: string;
  contentClassName?: string;

  // Loading State
  loading?: boolean;

  // Animation
  staggerChildren?: boolean;
  animationDelay?: number;
}

const gapClasses = {
  tight: "gap-4",
  normal: "gap-6",
  relaxed: "gap-8",
};

const getGridColumns = (
  columns: number,
  responsive?: UniversalKPISectionProps["responsiveColumns"],
): string => {
  const baseColumns = `grid-cols-${columns}`;

  if (!responsive) return baseColumns;

  const classes = [baseColumns];

  if (responsive.sm) classes.push(`sm:grid-cols-${responsive.sm}`);
  if (responsive.md) classes.push(`md:grid-cols-${responsive.md}`);
  if (responsive.lg) classes.push(`lg:grid-cols-${responsive.lg}`);
  if (responsive.xl) classes.push(`xl:grid-cols-${responsive.xl}`);

  return classes.join(" ");
};

export function UniversalKPISection({
  title,
  subtitle,
  kpis,
  columns = 4,
  responsiveColumns = { sm: 1, md: 2, lg: 4 },
  gap = "normal",
  cardSize = "md",
  cardVariant = "default",
  className = "",
  contentClassName = "",
  loading = false,
  staggerChildren = true,
  animationDelay = 0,
}: UniversalKPISectionProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delay: animationDelay,
        staggerChildren: staggerChildren ? 0.1 : 0,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  return (
    <motion.section
      className={cn("space-y-4", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Section Header */}
      {(title || subtitle) && (
        <div className="space-y-1">
          {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
        </div>
      )}

      {/* KPI Grid */}
      <motion.div
        className={cn(
          "grid",
          getGridColumns(columns, responsiveColumns),
          gapClasses[gap],
          contentClassName,
        )}
        variants={containerVariants}
      >
        {kpis.map((kpi, index) => (
          <motion.div key={kpi.id} variants={itemVariants}>
            <UniversalMetricCard {...kpi} size={cardSize} variant={cardVariant} loading={loading} />
          </motion.div>
        ))}
      </motion.div>

      {/* Empty State */}
      {kpis.length === 0 && !loading && (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-gray-500">No metrics available</p>
        </motion.div>
      )}

      {/* Loading State */}
      {loading && kpis.length === 0 && (
        <div className={cn("grid", getGridColumns(columns, responsiveColumns), gapClasses[gap])}>
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 animate-pulse"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-8 w-8 bg-gray-200 rounded-full" />
                </div>
                <div className="h-8 bg-gray-200 rounded w-16" />
                <div className="space-y-2">
                  <div className="h-2 bg-gray-200 rounded" />
                  <div className="flex justify-between">
                    <div className="h-3 bg-gray-200 rounded w-12" />
                    <div className="h-3 bg-gray-200 rounded w-12" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.section>
  );
}

export default UniversalKPISection;
