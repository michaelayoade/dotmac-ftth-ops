/**
 * Enhanced Status Indicators for ISP Management Platform
 * Improved visual hierarchy and ISP-specific status types
 * Security-hardened with input validation and XSS protection
 */

"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { useMemo, useCallback } from "react";
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
import type {
  StatusBadgeProps,
  UptimeIndicatorProps,
  NetworkPerformanceProps,
  ServiceTierProps,
  AlertSeverityProps,
  UptimeStatus,
  NetworkMetrics,
  ServiceTierConfig,
  AlertSeverityConfig,
  ServiceTier,
  AlertSeverity,
  StatusVariant,
} from "../types/status";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { cn } from "../utils/cn";

// Enhanced status badge variants
const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        // Network Status
        online:
          "bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200 shadow-sm",
        offline:
          "bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border border-red-200 shadow-sm",
        maintenance:
          "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 border border-amber-200 shadow-sm",
        degraded:
          "bg-gradient-to-r from-orange-50 to-red-50 text-orange-800 border border-orange-200 shadow-sm",

        // Service Status
        active:
          "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border border-blue-200 shadow-sm",
        suspended:
          "bg-gradient-to-r from-gray-50 to-slate-50 text-gray-800 border border-gray-200 shadow-sm",
        pending:
          "bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-800 border border-purple-200 shadow-sm",

        // Payment Status
        paid: "bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200 shadow-sm",
        overdue:
          "bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border border-red-200 shadow-sm",
        processing:
          "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border border-blue-200 shadow-sm",

        // Priority Levels
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

// Status indicator dot
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
      paid: "bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg shadow-green-400/40",
      overdue: "bg-gradient-to-r from-red-400 to-rose-500 shadow-lg shadow-red-400/40",
      processing: "bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/40",
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

// Security-hardened and accessible status badge component
export const StatusBadge: React.FC<StatusBadgeProps> = ({
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
  // Accessibility hooks
  const prefersReducedMotion = useReducedMotion();
  const badgeId = useMemo(() => generateId("status-badge"), []);

  // Sanitize className
  const safeClassName = useMemo(() => {
    return validateClassName(className);
  }, [className]);

  // Sanitize children if it's a string
  const safeChildren = useMemo(() => {
    if (typeof children === "string") {
      return sanitizeText(children);
    }
    return children;
  }, [children]);

  // Safe variant mapping
  const safeVariant = useMemo(() => {
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

    return variant && isValidVariant(variant) ? variant : "active";
  }, [variant]);

  // Generate accessible status text with text indicators
  const accessibleStatusText = useMemo(() => {
    const textIndicator =
      COLOR_CONTRAST.TEXT_INDICATORS[safeVariant as keyof typeof COLOR_CONTRAST.TEXT_INDICATORS];
    const childText = typeof safeChildren === "string" ? safeChildren : "";
    return generateStatusText(safeVariant, childText);
  }, [safeVariant, safeChildren]);

  // Handle click events safely
  const handleClick = useCallback(() => {
    try {
      if (onClick) {
        onClick();
        // Announce status change to screen readers
        announceToScreenReader(`Status changed to ${accessibleStatusText}`, "polite");
      }
    } catch (error) {
      console.error("StatusBadge click handler error:", error);
    }
  }, [onClick, accessibleStatusText]);

  // Keyboard event handling
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (onClick && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        handleClick();
      }
    },
    [onClick, handleClick],
  );

  const dotSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "md";

  // Determine animation behavior based on reduced motion preference
  const shouldAnimate = animated && !prefersReducedMotion;
  const shouldPulse = pulse && !prefersReducedMotion;

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
            variant: safeVariant,
            size,
            animated: shouldAnimate,
          }),
          safeClassName,
          // Focus styles for accessibility
          onClick &&
            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer",
          "transition-all duration-200 ease-in-out",
        )}
        onClick={onClick ? handleClick : undefined}
        onKeyDown={onClick ? handleKeyDown : undefined}
        role={onClick ? "button" : ARIA_ROLES.STATUS_INDICATOR}
        aria-label={ariaLabel || accessibleStatusText}
        aria-describedby={onClick ? `${badgeId}-description` : undefined}
        tabIndex={onClick ? 0 : -1}
        data-status={safeVariant}
      >
        {/* Screen reader text for color-independent status */}
        <span className="sr-only">{accessibleStatusText}</span>

        {/* Visual status dot */}
        {showDot && (
          <span
            className={cn(
              statusDotVariants({
                status: safeVariant,
                size: dotSize,
                pulse: shouldPulse,
              }),
            )}
            aria-hidden="true"
          />
        )}

        {/* Main content with text indicator for color independence */}
        <span className="flex items-center gap-1">
          {/* Text indicator for accessibility */}
          <span className="font-medium" aria-hidden="true">
            {COLOR_CONTRAST.TEXT_INDICATORS[
              safeVariant as keyof typeof COLOR_CONTRAST.TEXT_INDICATORS
            ]?.split(" ")[0] || "●"}
          </span>
          {safeChildren}
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
};

// Security-hardened service uptime indicator
export const UptimeIndicator: React.FC<UptimeIndicatorProps> = ({
  uptime,
  className,
  showLabel = true,
  "aria-label": ariaLabel,
}) => {
  // Validate uptime percentage
  const validatedUptime = useMemo(() => {
    try {
      return validateData(uptimeSchema, uptime);
    } catch (error) {
      console.error("Invalid uptime value:", error);
      return 0;
    }
  }, [uptime]);

  // Sanitize className
  const safeClassName = useMemo(() => {
    return validateClassName(className);
  }, [className]);

  // Memoized status calculation
  const uptimeStatus = useMemo((): UptimeStatus => {
    const percentage = validatedUptime;

    if (percentage >= 99.9) {
      return {
        status: "excellent",
        color: "text-green-600",
        bg: "bg-green-500",
        label: "Excellent",
      };
    }
    if (percentage >= 99.5) {
      return {
        status: "good",
        color: "text-blue-600",
        bg: "bg-blue-500",
        label: "Good",
      };
    }
    if (percentage >= 98) {
      return {
        status: "fair",
        color: "text-yellow-600",
        bg: "bg-yellow-500",
        label: "Fair",
      };
    }
    return {
      status: "poor",
      color: "text-red-600",
      bg: "bg-red-500",
      label: "Poor",
    };
  }, [validatedUptime]);

  // Safe width calculation (prevent CSS injection)
  const progressWidth = useMemo(() => {
    const width = Math.min(Math.max(validatedUptime, 0), 100);
    return `${width}%`;
  }, [validatedUptime]);

  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded text-sm text-gray-600">
          <span>Uptime data unavailable</span>
        </div>
      }
    >
      <div
        className={cn("flex items-center space-x-3", safeClassName)}
        role="progressbar"
        aria-valuenow={validatedUptime}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          ariaLabel || `Service uptime: ${validatedUptime.toFixed(2)}% - ${uptimeStatus.label}`
        }
      >
        <div className="flex-1">
          {showLabel && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Uptime</span>
              <span className={cn("text-sm font-bold", uptimeStatus.color)}>
                {validatedUptime.toFixed(2)}%
              </span>
            </div>
          )}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn("h-2 rounded-full transition-all duration-300", uptimeStatus.bg)}
              style={{ width: progressWidth }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

// Security-hardened network performance indicator
export const NetworkPerformanceIndicator: React.FC<NetworkPerformanceProps> = ({
  latency,
  packetLoss,
  bandwidth,
  className,
  onMetricClick,
}) => {
  // Validate network metrics
  const validatedMetrics = useMemo(() => {
    try {
      return validateData(networkMetricsSchema, {
        latency,
        packetLoss,
        bandwidth,
      });
    } catch (error) {
      console.error("Invalid network metrics:", error);
      return { latency: 0, packetLoss: 0, bandwidth: 0 };
    }
  }, [latency, packetLoss, bandwidth]);

  // Sanitize className
  const safeClassName = useMemo(() => {
    return validateClassName(className);
  }, [className]);

  // Centralized status configuration
  const networkStatus = useMemo((): NetworkMetrics => {
    const { latency: lat, packetLoss: loss, bandwidth: bw } = validatedMetrics;

    // Latency status
    let latencyStatus: "excellent" | "good" | "fair" | "poor";
    let latencyVariant: "online" | "active" | "maintenance" | "offline";

    if (lat < 20) {
      latencyStatus = "excellent";
      latencyVariant = "online";
    } else if (lat < 50) {
      latencyStatus = "good";
      latencyVariant = "active";
    } else if (lat < 100) {
      latencyStatus = "fair";
      latencyVariant = "maintenance";
    } else {
      latencyStatus = "poor";
      latencyVariant = "offline";
    }

    // Packet loss status
    let packetLossStatus: "excellent" | "good" | "fair" | "poor";
    let packetLossVariant: "online" | "active" | "maintenance" | "offline";

    if (loss < 0.01) {
      packetLossStatus = "excellent";
      packetLossVariant = "online";
    } else if (loss < 0.1) {
      packetLossStatus = "good";
      packetLossVariant = "active";
    } else if (loss < 1) {
      packetLossStatus = "fair";
      packetLossVariant = "maintenance";
    } else {
      packetLossStatus = "poor";
      packetLossVariant = "offline";
    }

    // Bandwidth status
    let bandwidthStatus: "high" | "medium" | "low";
    let bandwidthVariant: "online" | "maintenance" | "offline";

    if (bw > 80) {
      bandwidthStatus = "high";
      bandwidthVariant = "online";
    } else if (bw > 50) {
      bandwidthStatus = "medium";
      bandwidthVariant = "maintenance";
    } else {
      bandwidthStatus = "low";
      bandwidthVariant = "offline";
    }

    return {
      latency: {
        value: lat,
        status: latencyStatus,
        variant: latencyVariant,
      },
      packetLoss: {
        value: loss,
        status: packetLossStatus,
        variant: packetLossVariant,
      },
      bandwidth: {
        value: bw,
        status: bandwidthStatus,
        variant: bandwidthVariant,
      },
    };
  }, [validatedMetrics]);

  // Metric click handlers
  const handleLatencyClick = useCallback(() => {
    try {
      if (onMetricClick) {
        onMetricClick("latency");
      }
    } catch (error) {
      console.error("Latency click handler error:", error);
    }
  }, [onMetricClick]);

  const handlePacketLossClick = useCallback(() => {
    try {
      if (onMetricClick) {
        onMetricClick("packetLoss");
      }
    } catch (error) {
      console.error("Packet loss click handler error:", error);
    }
  }, [onMetricClick]);

  const handleBandwidthClick = useCallback(() => {
    try {
      if (onMetricClick) {
        onMetricClick("bandwidth");
      }
    } catch (error) {
      console.error("Bandwidth click handler error:", error);
    }
  }, [onMetricClick]);

  return (
    <ErrorBoundary
      fallback={
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-100 rounded text-sm text-gray-600">
          <div>Network metrics unavailable</div>
        </div>
      }
    >
      <div
        className={cn("grid grid-cols-3 gap-4", safeClassName)}
        role="group"
        aria-label="Network performance metrics"
      >
        {/* Latency */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <StatusBadge
              variant={networkStatus.latency.variant}
              size="sm"
              showDot={true}
              pulse={networkStatus.latency.value > 100}
              {...(onMetricClick ? { onClick: handleLatencyClick } : {})}
              aria-label={`Latency: ${networkStatus.latency.value}ms - ${networkStatus.latency.status}`}
            >
              {networkStatus.latency.value}ms
            </StatusBadge>
          </div>
          <p className="text-xs text-gray-600">Latency</p>
        </div>

        {/* Packet Loss */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <StatusBadge
              variant={networkStatus.packetLoss.variant}
              size="sm"
              showDot={true}
              pulse={networkStatus.packetLoss.value > 1}
              {...(onMetricClick ? { onClick: handlePacketLossClick } : {})}
              aria-label={`Packet Loss: ${networkStatus.packetLoss.value}% - ${networkStatus.packetLoss.status}`}
            >
              {networkStatus.packetLoss.value}%
            </StatusBadge>
          </div>
          <p className="text-xs text-gray-600">Packet Loss</p>
        </div>

        {/* Bandwidth */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <StatusBadge
              variant={networkStatus.bandwidth.variant}
              size="sm"
              showDot={true}
              {...(onMetricClick ? { onClick: handleBandwidthClick } : {})}
              aria-label={`Bandwidth: ${networkStatus.bandwidth.value}% - ${networkStatus.bandwidth.status}`}
            >
              {networkStatus.bandwidth.value}%
            </StatusBadge>
          </div>
          <p className="text-xs text-gray-600">Bandwidth</p>
        </div>
      </div>
    </ErrorBoundary>
  );
};

// Security-hardened service tier indicator
export const ServiceTierIndicator: React.FC<ServiceTierProps> = ({
  tier,
  className,
  onClick,
  "aria-label": ariaLabel,
}) => {
  // Validate service tier
  const validatedTier = useMemo<ServiceTier>(() => {
    try {
      return validateData(serviceTierSchema, tier) as ServiceTier;
    } catch (error) {
      console.error("Invalid service tier:", error);
      return "basic";
    }
  }, [tier]);

  // Sanitize className
  const safeClassName = useMemo(() => {
    return validateClassName(className);
  }, [className]);

  // Centralized tier configuration
  const tierConfig = useMemo(
    (): Record<ServiceTier, ServiceTierConfig> => ({
      basic: {
        label: "Basic",
        variant: "low",
        icon: "🥉",
        description: "Basic service tier",
      },
      standard: {
        label: "Standard",
        variant: "medium",
        icon: "🥈",
        description: "Standard service tier",
      },
      premium: {
        label: "Premium",
        variant: "high",
        icon: "🥇",
        description: "Premium service tier",
      },
      enterprise: {
        label: "Enterprise",
        variant: "critical",
        icon: "👑",
        description: "Enterprise service tier",
      },
    }),
    [],
  );

  const config = tierConfig[validatedTier] ?? tierConfig.basic;

  // Handle click events safely
  const handleClick = useCallback(() => {
    try {
      if (onClick) {
        onClick();
      }
    } catch (error) {
      console.error("Service tier click handler error:", error);
    }
  }, [onClick]);

  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded text-sm text-gray-600">
          <span>Service tier unavailable</span>
        </div>
      }
    >
      <div
        className={cn("flex items-center space-x-2", safeClassName)}
        onClick={onClick ? handleClick : undefined}
        role={onClick ? "button" : "status"}
        aria-label={ariaLabel || `Service tier: ${config.label} - ${config.description}`}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClick();
                }
              }
            : undefined
        }
      >
        <span className="text-lg" aria-hidden="true">
          {config.icon}
        </span>
        <StatusBadge variant={config.variant} size="md">
          {config.label}
        </StatusBadge>
      </div>
    </ErrorBoundary>
  );
};

// Security-hardened alert severity indicator
export const AlertSeverityIndicator: React.FC<AlertSeverityProps> = ({
  severity,
  message,
  timestamp,
  className,
  onDismiss,
  "aria-label": ariaLabel,
}) => {
  // Validate severity level
  const validatedSeverity = useMemo<AlertSeverity>(() => {
    try {
      return validateData(alertSeveritySchema, severity) as AlertSeverity;
    } catch (error) {
      console.error("Invalid alert severity:", error);
      return "info";
    }
  }, [severity]);

  // Sanitize message and className
  const safeMessage = useMemo(() => {
    return sanitizeText(message || "No message provided");
  }, [message]);

  const safeClassName = useMemo(() => {
    return validateClassName(className);
  }, [className]);

  // Centralized severity configuration
  const severityConfig = useMemo(
    (): Record<AlertSeverity, AlertSeverityConfig> => ({
      info: {
        variant: "active",
        icon: "ℹ️",
        bg: "bg-blue-50",
        border: "border-blue-200",
        textColor: "text-blue-900",
        description: "Information alert",
      },
      warning: {
        variant: "maintenance",
        icon: "⚠️",
        bg: "bg-amber-50",
        border: "border-amber-200",
        textColor: "text-amber-900",
        description: "Warning alert",
      },
      error: {
        variant: "offline",
        icon: "❌",
        bg: "bg-red-50",
        border: "border-red-200",
        textColor: "text-red-900",
        description: "Error alert",
      },
      critical: {
        variant: "critical",
        icon: "🚨",
        bg: "bg-red-50",
        border: "border-red-200",
        textColor: "text-red-900",
        description: "Critical alert",
      },
    }),
    [],
  );

  const config = severityConfig[validatedSeverity] ?? severityConfig.info;

  // Handle dismiss action safely
  const handleDismiss = useCallback(() => {
    try {
      if (onDismiss) {
        onDismiss();
      }
    } catch (error) {
      console.error("Alert dismiss handler error:", error);
    }
  }, [onDismiss]);

  // Format timestamp safely
  const formattedTimestamp = useMemo(() => {
    if (!timestamp) return null;

    try {
      return timestamp.toLocaleString();
    } catch (error) {
      console.error("Timestamp formatting error:", error);
      return "Invalid timestamp";
    }
  }, [timestamp]);

  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center p-4 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600">
          <span>Alert information unavailable</span>
        </div>
      }
    >
      <div
        className={cn(
          "flex items-start space-x-3 p-4 rounded-lg border",
          config.bg,
          config.border,
          safeClassName,
        )}
        role="alert"
        aria-live={validatedSeverity === "critical" ? "assertive" : "polite"}
        aria-label={ariaLabel || `${config.description}: ${safeMessage}`}
      >
        <div className="flex-shrink-0">
          <StatusBadge
            variant={config.variant}
            size="sm"
            pulse={validatedSeverity === "critical"}
            showDot={true}
          >
            <span className="mr-1" aria-hidden="true">
              {config.icon}
            </span>
            {validatedSeverity.toUpperCase()}
          </StatusBadge>
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium", config.textColor)}>{safeMessage}</p>
          {formattedTimestamp && (
            <p
              className="text-xs text-gray-500 mt-1"
              aria-label={`Alert time: ${formattedTimestamp}`}
            >
              {formattedTimestamp}
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
            aria-label="Dismiss alert"
            type="button"
          >
            <span className="text-lg" aria-hidden="true">
              ×
            </span>
          </button>
        )}
      </div>
    </ErrorBoundary>
  );
};

// Components are already exported individually above

export interface StatusIndicatorsProps extends Omit<StatusBadgeProps, "variant" | "children"> {
  status: StatusVariant;
  showLabel?: boolean;
  label?: string;
  children?: React.ReactNode;
}

export const StatusIndicators: React.FC<StatusIndicatorsProps> = ({
  showLabel = true,
  label,
  children,
  status,
  size,
  animated,
  className,
  showDot,
  pulse,
  onClick,
  "aria-label": ariaLabel,
}) => (
  <StatusBadge
    variant={status}
    {...(size ? { size } : {})}
    {...(animated !== undefined ? { animated } : {})}
    {...(className ? { className } : {})}
    {...(showDot !== undefined ? { showDot } : {})}
    {...(pulse !== undefined ? { pulse } : {})}
    {...(onClick ? { onClick } : {})}
    {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
  >
    {showLabel ? (label ?? status.replace(/_/g, " ").toUpperCase()) : null}
    {children}
  </StatusBadge>
);

// Export variants for external use
export { statusBadgeVariants, statusDotVariants };
