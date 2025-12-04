/**
 * Universal Metric Card Component
 * Standardized metric cards with progress indicators, trends, and status colors
 */

"use client";

import React from "react";
import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { cn } from "../utils/cn";

export interface MetricTrend {
  direction: "up" | "down" | "flat";
  percentage: number;
  label?: string;
}

export interface MetricProgress {
  current: number;
  target: number;
  label?: string;
  showPercentage?: boolean;
}

export interface MetricStatus {
  type: "success" | "warning" | "error" | "info" | "neutral";
  label?: string;
  threshold?: number;
}

export interface UniversalMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;

  // Visual Options
  variant?: "default" | "compact" | "featured";
  size?: "sm" | "md" | "lg";

  // Data Visualization
  trend?: MetricTrend;
  progress?: MetricProgress;
  status?: MetricStatus;

  // Formatting
  prefix?: string;
  suffix?: string;
  currency?: string;
  format?: "number" | "currency" | "percentage" | "duration" | "bytes";
  precision?: number;

  // Interaction
  onClick?: () => void;
  href?: string;
  loading?: boolean;

  // Layout
  className?: string;
  contentClassName?: string;
}

const statusColors = {
  success: {
    icon: "text-green-600",
    bg: "bg-green-100",
    progress: "bg-green-500",
    border: "border-green-200",
  },
  warning: {
    icon: "text-yellow-600",
    bg: "bg-yellow-100",
    progress: "bg-yellow-500",
    border: "border-yellow-200",
  },
  error: {
    icon: "text-red-600",
    bg: "bg-red-100",
    progress: "bg-red-500",
    border: "border-red-200",
  },
  info: {
    icon: "text-blue-600",
    bg: "bg-blue-100",
    progress: "bg-blue-500",
    border: "border-blue-200",
  },
  neutral: {
    icon: "text-gray-600",
    bg: "bg-gray-100",
    progress: "bg-gray-500",
    border: "border-gray-200",
  },
};

const sizeClasses = {
  sm: {
    card: "p-4",
    title: "text-sm",
    value: "text-xl",
    icon: "w-5 h-5",
    iconContainer: "p-2",
  },
  md: {
    card: "p-5",
    title: "text-sm",
    value: "text-2xl",
    icon: "w-6 h-6",
    iconContainer: "p-3",
  },
  lg: {
    card: "p-6",
    title: "text-base",
    value: "text-3xl",
    icon: "w-7 h-7",
    iconContainer: "p-3",
  },
};

export function UniversalMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  size = "md",
  trend,
  progress,
  status,
  prefix = "",
  suffix = "",
  currency = "USD",
  format = "number",
  precision = 0,
  onClick,
  href,
  loading = false,
  className = "",
  contentClassName = "",
}: UniversalMetricCardProps) {
  const sizes = sizeClasses[size];
  const colors = status ? statusColors[status.type] : statusColors.neutral;

  const formatValue = (rawValue: string | number): string => {
    if (loading) return "...";

    const numValue = typeof rawValue === "string" ? parseFloat(rawValue) || 0 : rawValue;

    switch (format) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        }).format(numValue);

      case "percentage":
        return `${numValue.toFixed(precision)}%`;

      case "duration":
        if (numValue < 60) return `${numValue.toFixed(precision)}s`;
        if (numValue < 3600) return `${(numValue / 60).toFixed(precision)}m`;
        return `${(numValue / 3600).toFixed(precision)}h`;

      case "bytes":
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        if (numValue === 0) return "0 B";
        const i = Math.floor(Math.log(numValue) / Math.log(1024));
        return `${(numValue / Math.pow(1024, i)).toFixed(precision)} ${sizes[i]}`;

      case "number":
      default:
        return `${prefix}${numValue.toLocaleString("en-US", {
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        })}${suffix}`;
    }
  };

  const calculateProgress = (): number => {
    if (!progress) return 0;
    return Math.min((progress.current / progress.target) * 100, 100);
  };

  const getTrendIcon = () => {
    if (!trend) return null;

    switch (trend.direction) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case "flat":
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return "text-gray-500";

    switch (trend.direction) {
      case "up":
        return "text-green-600";
      case "down":
        return "text-red-600";
      case "flat":
      default:
        return "text-gray-500";
    }
  };

  const hoverMotionProps: Partial<HTMLMotionProps<"div">> = onClick
    ? { whileHover: { y: -1 } }
    : {};

  const cardContent = (
    <motion.div
      className={cn(
        "bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md hover:border-gray-300",
        variant === "featured" && "border-2",
        variant === "featured" && status && colors.border,
        sizes.card,
        className,
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      {...hoverMotionProps}
    >
      <div className={cn("space-y-3", contentClassName)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className={cn("font-medium text-gray-600 truncate", sizes.title)}>{title}</p>
            {subtitle && <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>}
          </div>

          {Icon && (
            <div className={cn("rounded-full flex-shrink-0", colors.bg, sizes.iconContainer)}>
              <Icon className={cn(colors.icon, sizes.icon)} />
            </div>
          )}
        </div>

        {/* Value */}
        <div>
          <p className={cn("font-bold text-gray-900 leading-none", sizes.value)}>
            {formatValue(value)}
          </p>
        </div>

        {/* Progress Bar */}
        {progress && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{progress.label || "Progress"}</span>
              {progress.showPercentage !== false && (
                <span className="text-gray-700 font-medium">{calculateProgress().toFixed(1)}%</span>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                className={cn("h-2 rounded-full", colors.progress)}
                initial={{ width: 0 }}
                animate={{ width: `${calculateProgress()}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{progress.current.toLocaleString()}</span>
              <span>of {progress.target.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Trend */}
        {trend && (
          <div className="flex items-center space-x-2">
            {getTrendIcon()}
            <span className={cn("text-sm font-medium", getTrendColor())}>
              {trend.percentage > 0 ? "+" : ""}
              {trend.percentage.toFixed(1)}%
            </span>
            {trend.label && <span className="text-sm text-gray-500">{trend.label}</span>}
          </div>
        )}

        {/* Status */}
        {status && status.label && (
          <div className="flex items-center space-x-2">
            {status.type === "warning" || status.type === "error" ? (
              <AlertTriangle className={cn("w-4 h-4", colors.icon)} />
            ) : null}
            <span className={cn("text-sm", colors.icon)}>{status.label}</span>
          </div>
        )}
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {cardContent}
      </a>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className="block text-left w-full">
        {cardContent}
      </button>
    );
  }

  return cardContent;
}

export default UniversalMetricCard;
