"use client";

import { AnimatedCounter, AnimatedCard, FadeInWhenVisible } from "@dotmac/primitives";
import { AlertCircle, ArrowUpRight, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { cn } from "../lib/utils";

interface MetricCardEnhancedProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  href?: string;
  currency?: boolean;
  loading?: boolean;
  error?: string;
  emptyStateMessage?: string;
  className?: string;
}

export function MetricCardEnhanced({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  href,
  currency,
  loading = false,
  error,
  emptyStateMessage,
  className = "",
}: MetricCardEnhancedProps) {
  const numericValue = React.useMemo(() => {
    if (typeof value === "number") return value;
    const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }, [value]);

  const formattedValue = React.useMemo(() => {
    if (currency && typeof value === "number") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
    }
    return value;
  }, [value, currency]);

  const isEmpty = value === 0 || value === "0";
  const showEmptyState = isEmpty && emptyStateMessage && !loading && !error;
  const shouldAnimate = !loading && !error && typeof value === "number";

  const content = (
    <AnimatedCard
      disabled={loading || !!error}
      className={cn(
        "group relative rounded-lg border p-6 transition-all duration-200",
        "bg-card border-border",
        !error &&
          "hover:border-border dark:hover:border-border hover:shadow-lg hover:shadow-sky-500/5",
        error && "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
            {title}
          </p>

          {loading ? (
            <div className="space-y-2">
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
              <div className="h-3 w-32 bg-muted animate-pulse rounded" />
            </div>
          ) : error ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm">Failed to load</p>
              </div>
              <p className="text-xs text-red-400/70">{error}</p>
            </div>
          ) : (
            <>
              {shouldAnimate ? (
                <AnimatedCounter
                  value={numericValue}
                  duration={1.5}
                  prefix={currency ? "$" : ""}
                  className={cn(
                    "text-3xl font-bold transition-colors duration-200",
                    showEmptyState
                      ? "text-muted-foreground"
                      : "text-foreground group-hover:text-sky-400",
                  )}
                />
              ) : (
                <p
                  className={cn(
                    "text-3xl font-bold transition-colors duration-200",
                    showEmptyState
                      ? "text-muted-foreground"
                      : "text-foreground group-hover:text-sky-400",
                  )}
                >
                  {formattedValue}
                </p>
              )}

              {showEmptyState ? (
                <p className="text-xs text-muted-foreground italic">{emptyStateMessage}</p>
              ) : subtitle ? (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              ) : null}

              {trend && !showEmptyState && (
                <div
                  className={cn(
                    "flex items-center text-sm transition-colors duration-200",
                    trend.isPositive ? "text-green-400" : "text-red-400",
                  )}
                >
                  <TrendingUp
                    className={cn(
                      "h-4 w-4 mr-1 transition-transform duration-200",
                      !trend.isPositive && "rotate-180",
                    )}
                  />
                  {Math.abs(trend.value)}% from last month
                </div>
              )}
            </>
          )}
        </div>

        <div
          className={cn(
            "p-3 rounded-lg transition-all duration-200",
            error ? "bg-red-900/30" : "bg-muted group-hover:bg-muted group-hover:scale-110",
          )}
        >
          {error ? (
            <AlertCircle className="h-6 w-6 text-red-400" />
          ) : (
            <Icon
              className={cn(
                "h-6 w-6 transition-colors duration-200",
                showEmptyState ? "text-muted-foreground" : "text-sky-400 group-hover:text-sky-300",
              )}
            />
          )}
        </div>
      </div>
    </AnimatedCard>
  );

  if (href && !error && !loading) {
    return (
      <FadeInWhenVisible>
        <Link href={href} className="block relative group/link">
          {content}
          <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-foreground opacity-0 group-hover/link:opacity-100 transition-all duration-200 transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
        </Link>
      </FadeInWhenVisible>
    );
  }

  return <FadeInWhenVisible>{content}</FadeInWhenVisible>;
}
