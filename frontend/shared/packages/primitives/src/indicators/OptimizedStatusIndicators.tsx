/**
 * Performance-Optimized Status Indicators
 * Advanced state management and render optimization patterns
 */

"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { useMemo, useCallback, memo, useState, useRef, useEffect } from "react";
import { cn } from "../utils/cn";
import { sanitizeText, validateClassName, validateData } from "../utils/security";
import {
  uptimeSchema,
  networkMetricsSchema,
  serviceTierSchema,
  alertSeveritySchema,
} from "../utils/security";
import {
  generateStatusText,
  useKeyboardNavigation,
  useFocusManagement,
  useReducedMotion,
  useScreenReader,
  announceToScreenReader,
  generateId,
  ARIA_ROLES,
  COLOR_CONTRAST,
} from "../utils/a11y";
import {
  useRenderProfiler,
  useThrottledState,
  useDebouncedState,
  useDeepMemo,
  createMemoizedSelector,
} from "../utils/performance";
import type {
  StatusBadgeProps,
  UptimeIndicatorProps,
  NetworkPerformanceProps,
  ServiceTierProps,
  AlertSeverityProps,
  StatusSize,
  UptimeStatus,
  NetworkMetrics,
  ServiceTierConfig,
  AlertSeverityConfig,
} from "../types/status";
import { ErrorBoundary } from "../components/ErrorBoundary";

// Memoized status badge variants
const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        online:
          "bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200 shadow-sm",
        offline:
          "bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border border-red-200 shadow-sm",
        maintenance:
          "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 border border-amber-200 shadow-sm",
        degraded:
          "bg-gradient-to-r from-orange-50 to-red-50 text-orange-800 border border-orange-200 shadow-sm",
        active:
          "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border border-blue-200 shadow-sm",
        suspended:
          "bg-gradient-to-r from-gray-50 to-slate-50 text-gray-800 border border-gray-200 shadow-sm",
        pending:
          "bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-800 border border-purple-200 shadow-sm",
        paid: "bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200 shadow-sm",
        overdue:
          "bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border border-red-200 shadow-sm",
        processing:
          "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border border-blue-200 shadow-sm",
        critical:
          "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25",
        high: "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25",
        medium:
          "bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/25",
        low: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25",
      },
      size: {
        sm: "px-2 py-1 text-xs",
        md: "px-3 py-1.5 text-sm",
        lg: "px-4 py-2 text-base",
      },
      animated: {
        true: "animate-pulse",
        false: "",
      },
    },
    defaultVariants: {
      variant: "active",
      size: "md",
      animated: false,
    },
  },
);

// Optimized status dot variants
const statusDotVariants = cva("rounded-full flex-shrink-0 transition-all duration-200", {
  variants: {
    status: {
      online: "bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg shadow-green-400/50",
      offline: "bg-gradient-to-r from-red-400 to-rose-500 shadow-lg shadow-red-400/50",
      maintenance: "bg-gradient-to-r from-amber-400 to-yellow-500 shadow-lg shadow-amber-400/50",
      degraded: "bg-gradient-to-r from-orange-400 to-red-500 shadow-lg shadow-orange-400/50",
      active: "bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/50",
      suspended: "bg-gradient-to-r from-gray-400 to-slate-500 shadow-lg shadow-gray-400/50",
      pending: "bg-gradient-to-r from-purple-400 to-indigo-500 shadow-lg shadow-purple-400/50",
      paid: "bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg shadow-green-400/50",
      overdue: "bg-gradient-to-r from-red-400 to-rose-500 shadow-lg shadow-red-400/50",
      processing: "bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/50",
      critical: "bg-gradient-to-r from-red-500 to-rose-600 shadow-lg shadow-red-500/40",
      high: "bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/40",
      medium: "bg-gradient-to-r from-yellow-500 to-orange-500 shadow-lg shadow-yellow-500/40",
      low: "bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/40",
    },
    size: {
      sm: "w-2 h-2",
      md: "w-3 h-3",
      lg: "w-4 h-4",
    },
    pulse: {
      true: "animate-ping",
      false: "",
    },
  },
  defaultVariants: {
    status: "active",
    size: "md",
    pulse: false,
  },
});

// High-performance status badge with advanced optimization
export const OptimizedStatusBadge: React.FC<StatusBadgeProps> = memo(
  ({
    variant,
    size,
    animated,
    children,
    className,
    showDot = true,
    pulse = false,
    onClick,
    "aria-label": ariaLabel,
  }) => {
    // Performance monitoring
    const { renderCount } = useRenderProfiler("OptimizedStatusBadge", {
      variant,
      size,
    });

    // Optimized state management
    const [isPressed, setIsPressed] = useThrottledState(false, 50);
    const [isFocused, setIsFocused, throttledIsFocused] = useThrottledState(false, 16);

    // Accessibility hooks with debouncing
    const prefersReducedMotion = useReducedMotion();
    const badgeId = useMemo(() => generateId("status-badge"), []);

    // Memoized computed values
    const computedValues = useMemo(() => {
      const safeClassName = validateClassName(className);
      const safeChildren = typeof children === "string" ? sanitizeText(children) : children;

      const validVariants = [
        "online",
        "offline",
        "maintenance",
        "degraded",
        "active",
        "suspended",
        "pending",
        "paid",
        "overdue",
        "processing",
        "critical",
        "high",
        "medium",
        "low",
      ] as const;

      type ValidVariant = (typeof validVariants)[number];
      const isValidVariant = (value: string): value is ValidVariant =>
        validVariants.includes(value as ValidVariant);

      const safeVariant: ValidVariant = variant && isValidVariant(variant) ? variant : "active";

      const textIndicator =
        COLOR_CONTRAST.TEXT_INDICATORS[safeVariant as keyof typeof COLOR_CONTRAST.TEXT_INDICATORS];
      const childText = typeof safeChildren === "string" ? safeChildren : "";
      const accessibleStatusText = generateStatusText(safeVariant, childText);

      return {
        safeClassName,
        safeChildren,
        safeVariant,
        accessibleStatusText,
        textIndicator,
      };
    }, [className, children, variant]);

    // Optimized animation behavior
    const animationConfig = useMemo(() => {
      const dotSize: StatusSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "md";
      return {
        shouldAnimate: animated && !prefersReducedMotion,
        shouldPulse: pulse && !prefersReducedMotion,
        dotSize,
      };
    }, [animated, pulse, prefersReducedMotion, size]);

    // Debounced click handler to prevent rapid firing
    const [, , debouncedClickHandler] = useDebouncedState(null, 150);

    const handleClick = useCallback(() => {
      try {
        if (onClick) {
          setIsPressed(true);
          onClick();
          announceToScreenReader(
            `Status changed to ${computedValues.accessibleStatusText}`,
            "polite",
          );
          setTimeout(() => setIsPressed(false), 100);
        }
      } catch (error) {
        console.error("StatusBadge click handler error:", error);
      }
    }, [onClick, computedValues.accessibleStatusText, setIsPressed]);

    // Optimized keyboard event handling
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          handleClick();
        }
      },
      [onClick, handleClick],
    );

    // Focus management with throttling
    const handleFocus = useCallback(() => setIsFocused(true), [setIsFocused]);
    const handleBlur = useCallback(() => setIsFocused(false), [setIsFocused]);

    return (
      <ErrorBoundary
        fallback={
          <span
            className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
            role="status"
            aria-label="Status indicator error"
          >
            Status Error
          </span>
        }
      >
        <span
          id={badgeId}
          className={cn(
            statusBadgeVariants({
              variant: computedValues.safeVariant,
              size,
              animated: animationConfig.shouldAnimate,
            }),
            computedValues.safeClassName,
            // Focus styles with throttled state
            onClick && throttledIsFocused && "ring-2 ring-offset-2 ring-blue-500",
            onClick && isPressed && "scale-95 transform",
            onClick && "cursor-pointer transition-transform duration-75",
            "transition-all duration-200 ease-in-out",
          )}
          onClick={onClick ? handleClick : undefined}
          onKeyDown={onClick ? handleKeyDown : undefined}
          onFocus={onClick ? handleFocus : undefined}
          onBlur={onClick ? handleBlur : undefined}
          role={onClick ? "button" : ARIA_ROLES.STATUS_INDICATOR}
          aria-label={ariaLabel || computedValues.accessibleStatusText}
          aria-describedby={onClick ? `${badgeId}-description` : undefined}
          tabIndex={onClick ? 0 : -1}
          data-status={computedValues.safeVariant}
          data-render-count={renderCount}
        >
          {/* Screen reader text for color-independent status */}
          <span className="sr-only">{computedValues.accessibleStatusText}</span>

          {/* Visual status dot with optimized rendering */}
          {showDot && (
            <span
              className={cn(
                statusDotVariants({
                  status: computedValues.safeVariant,
                  size: animationConfig.dotSize,
                  pulse: animationConfig.shouldPulse,
                }),
              )}
              aria-hidden="true"
            />
          )}

          {/* Main content with text indicator for color independence */}
          <span className="flex items-center gap-1">
            {/* Text indicator for accessibility */}
            <span className="font-medium" aria-hidden="true">
              {computedValues.textIndicator?.split(" ")[0] || "●"}
            </span>
            {computedValues.safeChildren}
          </span>

          {/* Description for interactive elements */}
          {onClick && (
            <span id={`${badgeId}-description`} className="sr-only">
              Press Enter or Space to interact with this status indicator
            </span>
          )}
        </span>
      </ErrorBoundary>
    );
  },
  (prevProps, nextProps) => {
    // Optimized shallow comparison with critical props check
    return (
      prevProps.variant === nextProps.variant &&
      prevProps.size === nextProps.size &&
      prevProps.animated === nextProps.animated &&
      prevProps.showDot === nextProps.showDot &&
      prevProps.pulse === nextProps.pulse &&
      prevProps.className === nextProps.className &&
      prevProps.onClick === nextProps.onClick &&
      prevProps["aria-label"] === nextProps["aria-label"] &&
      (typeof prevProps.children === "string" && typeof nextProps.children === "string"
        ? prevProps.children === nextProps.children
        : prevProps.children === nextProps.children)
    );
  },
);

// High-performance uptime indicator with virtualized progress
export const OptimizedUptimeIndicator: React.FC<UptimeIndicatorProps> = memo(
  ({ uptime, className, showLabel = true, "aria-label": ariaLabel }) => {
    // Performance monitoring
    const { renderCount } = useRenderProfiler("OptimizedUptimeIndicator", {
      uptime,
    });

    // Optimized state management with animation throttling
    const [animatedUptime, setAnimatedUptime] = useThrottledState(uptime, 100);
    const animationRef = useRef<number>();

    // Animate uptime changes for smooth transitions
    useEffect(() => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      const startTime = performance.now();
      const startValue = animatedUptime;
      const duration = 1000; // 1 second animation

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (uptime - startValue) * easeOutCubic;

        setAnimatedUptime(currentValue);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, [uptime, animatedUptime, setAnimatedUptime]);

    // Memoized validation and computations
    const computedValues = useMemo(() => {
      let validatedUptime: number;
      try {
        validatedUptime = validateData(uptimeSchema, uptime);
      } catch (error) {
        console.error("Invalid uptime value:", error);
        validatedUptime = 0;
      }

      const safeClassName = validateClassName(className);

      // Uptime status with optimized calculation
      let uptimeStatus: UptimeStatus;
      if (validatedUptime >= 99.9) {
        uptimeStatus = {
          status: "excellent",
          color: "text-green-600",
          bg: "bg-green-500",
          label: "Excellent",
        };
      } else if (validatedUptime >= 99.5) {
        uptimeStatus = {
          status: "good",
          color: "text-blue-600",
          bg: "bg-blue-500",
          label: "Good",
        };
      } else if (validatedUptime >= 98) {
        uptimeStatus = {
          status: "fair",
          color: "text-yellow-600",
          bg: "bg-yellow-500",
          label: "Fair",
        };
      } else {
        uptimeStatus = {
          status: "poor",
          color: "text-red-600",
          bg: "bg-red-500",
          label: "Poor",
        };
      }

      // Safe width calculation with bounds checking
      const progressWidth = `${Math.min(Math.max(validatedUptime, 0), 100)}%`;

      return {
        validatedUptime,
        safeClassName,
        uptimeStatus,
        progressWidth,
      };
    }, [uptime, className]);

    // Cleanup animation on unmount
    useEffect(() => {
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, []);

    return (
      <ErrorBoundary
        fallback={
          <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded text-sm text-gray-600">
            <span>Uptime data unavailable</span>
          </div>
        }
      >
        <div
          className={cn("flex items-center space-x-3", computedValues.safeClassName)}
          role="progressbar"
          aria-valuenow={computedValues.validatedUptime}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={
            ariaLabel ||
            `Service uptime: ${computedValues.validatedUptime.toFixed(2)}% - ${computedValues.uptimeStatus.label}`
          }
          data-render-count={renderCount}
        >
          <div className="flex-1">
            {showLabel && (
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Uptime</span>
                <span className={cn("text-sm font-bold", computedValues.uptimeStatus.color)}>
                  {animatedUptime.toFixed(2)}%
                </span>
              </div>
            )}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={cn(
                  "h-2 rounded-full transition-all duration-300 ease-out",
                  computedValues.uptimeStatus.bg,
                )}
                style={{ width: computedValues.progressWidth }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.uptime === nextProps.uptime &&
      prevProps.className === nextProps.className &&
      prevProps.showLabel === nextProps.showLabel &&
      prevProps["aria-label"] === nextProps["aria-label"]
    );
  },
);

// Export optimized components
export { statusBadgeVariants, statusDotVariants };
