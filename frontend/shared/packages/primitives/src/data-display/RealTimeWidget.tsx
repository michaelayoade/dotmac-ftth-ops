/**
 * Real-time monitoring widgets for live data updates
 */
"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import type React from "react";
import { forwardRef, useEffect, useRef, useState } from "react";

// Widget variants
const widgetVariants = cva("real-time-widget", {
  variants: {
    size: {
      sm: "widget-sm",
      md: "widget-md",
      lg: "widget-lg",
      xl: "widget-xl",
    },
    variant: {
      default: "widget-default",
      outlined: "widget-outlined",
      filled: "widget-filled",
      minimal: "widget-minimal",
    },
    status: {
      normal: "status-normal",
      warning: "status-warning",
      critical: "status-critical",
      offline: "status-offline",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "default",
    status: "normal",
  },
});

// Base real-time widget props
export interface BaseRealTimeWidgetProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof widgetVariants> {
  title: string;
  subtitle?: string;
  refreshInterval?: number; // in seconds
  onRefresh?: () => void;
  loading?: boolean;
  error?: string;
  lastUpdated?: Date;
  actions?: React.ReactNode;
}

// Status indicator component
export interface StatusIndicatorProps {
  status: "online" | "offline" | "warning" | "critical";
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
}

export function StatusIndicator({ status, pulse = false, size = "md" }: StatusIndicatorProps) {
  return (
    <div
      className={clsx("status-indicator", `status-${status}`, `size-${size}`, {
        pulse,
      })}
      title={status.charAt(0).toUpperCase() + status.slice(1)}
    >
      <div className="status-dot" />
    </div>
  );
}

// Base real-time widget
const BaseRealTimeWidget = forwardRef<HTMLDivElement, BaseRealTimeWidgetProps>(
  (
    {
      className,
      title,
      subtitle,
      refreshInterval = 30,
      onRefresh,
      loading = false,
      error,
      lastUpdated,
      actions,
      size,
      variant,
      status,
      children,
      ...props
    },
    ref,
  ) => {
    const [timeLeft, setTimeLeft] = useState(refreshInterval);
    const intervalRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
      if (!onRefresh) {
        return;
      }

      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            onRefresh();
            return refreshInterval;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }, [refreshInterval, onRefresh]);

    const handleManualRefresh = () => {
      if (onRefresh) {
        onRefresh();
        setTimeLeft(refreshInterval);
      }
    };

    return (
      <div
        ref={ref}
        className={clsx(widgetVariants({ size, variant, status }), className)}
        {...props}
      >
        <div className="widget-header">
          <div className="widget-title-section">
            <h3 className="widget-title">{title}</h3>
            {subtitle ? <p className="widget-subtitle">{subtitle}</p> : null}
          </div>

          <div className="widget-controls">
            {onRefresh ? (
              <div className="refresh-controls">
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  onKeyDown={(e) => e.key === "Enter" && handleManualRefresh}
                  className="refresh-button"
                  disabled={loading}
                  title="Refresh now"
                >
                  🔄
                </button>
                <span className="refresh-timer" title={`Auto-refresh in ${timeLeft}s`}>
                  {timeLeft}s
                </span>
              </div>
            ) : null}
            {actions ? <div className="widget-actions">{actions}</div> : null}
          </div>
        </div>

        <div className="widget-content">
          {loading ? (
            <div className="widget-loading">
              <div className="loading-spinner" />
              <span>Updating...</span>
            </div>
          ) : null}

          {error ? (
            <div className="widget-error">
              <span className="error-icon">⚠️</span>
              <span className="error-message">{error}</span>
              <button
                type="button"
                onClick={handleManualRefresh}
                onKeyDown={(e) => e.key === "Enter" && handleManualRefresh}
                className="retry-button"
              >
                Retry
              </button>
            </div>
          ) : null}

          {!loading && !error && children}
        </div>

        {lastUpdated ? (
          <div className="widget-footer">
            <span className="last-updated">Last updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
        ) : null}
      </div>
    );
  },
);

// Network device status widget
export interface NetworkDeviceWidgetProps extends Omit<BaseRealTimeWidgetProps, "title"> {
  device: {
    id: string;
    name: string;
    type: string;
    status: "online" | "offline" | "warning" | "critical";
    ipAddress: string;
    uptime: number;
    lastSeen: Date;
    metrics: {
      cpuUsage: number;
      memoryUsage: number;
      networkUtilization: number;
      temperature?: number;
    };
  };
}

export function NetworkDeviceWidget({ device, className, ...props }: NetworkDeviceWidgetProps) {
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getMetricColor = (value: number, thresholds = { warning: 70, critical: 90 }) => {
    if (value >= thresholds.critical) {
      return "critical";
    }
    if (value >= thresholds.warning) {
      return "warning";
    }
    return "normal";
  };

  const widgetStatus = device.status === "online" ? "normal" : device.status;

  return (
    <BaseRealTimeWidget
      title={device.name}
      subtitle={`${device.type} • ${device.ipAddress}`}
      status={widgetStatus}
      className={clsx("network-device-widget", className)}
      {...props}
    >
      <div className="device-status-section">
        <div className="status-row">
          <StatusIndicator status={device.status} pulse={device.status !== "offline"} />
          <span className="status-text">{device.status.toUpperCase()}</span>
          <span className="uptime">Uptime: {formatUptime(device.uptime)}</span>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-item">
          <label htmlFor={`input-${Math.random().toString(36).substr(2, 9)}`}>CPU Usage</label>
          <div className="metric-bar-container">
            <div
              className={clsx("metric-bar", `metric-${getMetricColor(device.metrics.cpuUsage)}`)}
              style={{ width: `${device.metrics.cpuUsage}%` }}
            />
            <span className="metric-value">{device.metrics.cpuUsage}%</span>
          </div>
        </div>

        <div className="metric-item">
          <label htmlFor={`input-${Math.random().toString(36).substr(2, 9)}`}>Memory Usage</label>
          <div className="metric-bar-container">
            <div
              className={clsx("metric-bar", `metric-${getMetricColor(device.metrics.memoryUsage)}`)}
              style={{ width: `${device.metrics.memoryUsage}%` }}
            />
            <span className="metric-value">{device.metrics.memoryUsage}%</span>
          </div>
        </div>

        <div className="metric-item">
          <label htmlFor={`input-${Math.random().toString(36).substr(2, 9)}`}>
            Network Utilization
          </label>
          <div className="metric-bar-container">
            <div
              className={clsx(
                "metric-bar",
                `metric-${getMetricColor(device.metrics.networkUtilization)}`,
              )}
              style={{ width: `${device.metrics.networkUtilization}%` }}
            />
            <span className="metric-value">{device.metrics.networkUtilization}%</span>
          </div>
        </div>

        {device.metrics.temperature ? (
          <div className="metric-item">
            <label htmlFor={`input-${Math.random().toString(36).substr(2, 9)}`}>Temperature</label>
            <div className="metric-bar-container">
              <div
                className={clsx(
                  "metric-bar",
                  `metric-${getMetricColor(device.metrics.temperature, { warning: 60, critical: 80 })}`,
                )}
                style={{
                  width: `${Math.min(device.metrics.temperature, 100)}%`,
                }}
              />
              <span className="metric-value">{device.metrics.temperature}°C</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="device-footer">
        <small>Last seen: {device.lastSeen.toLocaleString()}</small>
      </div>
    </BaseRealTimeWidget>
  );
}

// Service health widget
export interface ServiceHealthWidgetProps extends Omit<BaseRealTimeWidgetProps, "title"> {
  service: {
    name: string;
    status: "healthy" | "degraded" | "unhealthy" | "unknown";
    responseTime: number;
    uptime: number;
    version: string;
    endpoints: Array<{
      name: string;
      status: "up" | "down" | "degraded";
      responseTime: number;
    }>;
  };
}

export function ServiceHealthWidget({ service, className, ...props }: ServiceHealthWidgetProps) {
  const getStatusColor = (status: string): "online" | "offline" | "warning" | "critical" => {
    switch (status) {
      case "healthy":
      case "up":
        return "online";
      case "degraded":
        return "warning";
      case "unhealthy":
      case "down":
        return "critical";
      default:
        return "offline";
    }
  };

  const serviceStatus = getStatusColor(service.status);
  const widgetStatus = serviceStatus === "online" ? "normal" : serviceStatus;

  return (
    <BaseRealTimeWidget
      title={service.name}
      subtitle={`v${service.version} • ${(service.uptime * 100).toFixed(2)}% uptime`}
      status={widgetStatus}
      className={clsx("service-health-widget", className)}
      {...props}
    >
      <div className="service-overview">
        <div className="overview-item">
          <label htmlFor={`input-${Math.random().toString(36).substr(2, 9)}`}>Status</label>
          <div className="status-badge">
            <StatusIndicator status={serviceStatus} size="sm" />
            <span>{service.status.toUpperCase()}</span>
          </div>
        </div>

        <div className="overview-item">
          <label htmlFor={`input-${Math.random().toString(36).substr(2, 9)}`}>Response Time</label>
          <span className="response-time">{service.responseTime}ms</span>
        </div>
      </div>

      <div className="endpoints-list">
        <h4>Endpoints</h4>
        {service.endpoints.map((endpoint, index) => (
          <div key={`item-${index}`} className="endpoint-item">
            <StatusIndicator status={getStatusColor(endpoint.status)} size="sm" />
            <span className="endpoint-name">{endpoint.name}</span>
            <span className="endpoint-response-time">{endpoint.responseTime}ms</span>
          </div>
        ))}
      </div>
    </BaseRealTimeWidget>
  );
}

// Real-time metrics widget
export interface RealTimeMetricsWidgetProps extends Omit<BaseRealTimeWidgetProps, "title"> {
  title: string;
  metrics: Array<{
    label: string;
    value: number;
    unit?: string;
    trend?: {
      direction: "up" | "down" | "stable";
      percentage: number;
    };
    threshold?: {
      warning: number;
      critical: number;
    };
  }>;
}

export function RealTimeMetricsWidget({
  title,
  metrics,
  className,
  ...props
}: RealTimeMetricsWidgetProps) {
  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case "up":
        return "↗️";
      case "down":
        return "↘️";
      default:
        return "→";
    }
  };

  const getMetricStatus = (value: number, threshold?: { warning: number; critical: number }) => {
    if (!threshold) {
      return "normal";
    }
    if (value >= threshold.critical) {
      return "critical";
    }
    if (value >= threshold.warning) {
      return "warning";
    }
    return "normal";
  };

  return (
    <BaseRealTimeWidget
      title={title}
      className={clsx("real-time-metrics-widget", className)}
      {...props}
    >
      <div className="metrics-list">
        {metrics.map((metric, index) => (
          <div key={`item-${index}`} className="metric-row">
            <div className="metric-info">
              <label
                htmlFor={`input-${Math.random().toString(36).substr(2, 9)}`}
                className="metric-label"
              >
                {metric.label}
              </label>
              <div className="metric-value-container">
                <span
                  className={clsx(
                    "metric-value",
                    `status-${getMetricStatus(metric.value, metric.threshold)}`,
                  )}
                >
                  {metric.value.toLocaleString()}
                  {metric.unit ? <span className="metric-unit">{metric.unit}</span> : null}
                </span>
                {metric.trend ? (
                  <div className={clsx("metric-trend", `trend-${metric.trend.direction}`)}>
                    <span className="trend-icon">{getTrendIcon(metric.trend.direction)}</span>
                    <span className="trend-value">{metric.trend.percentage}%</span>
                  </div>
                ) : null}
              </div>
            </div>

            {metric.threshold ? (
              <div className="metric-threshold-bar">
                <div
                  className="threshold-fill"
                  style={{
                    width: `${Math.min((metric.value / metric.threshold.critical) * 100, 100)}%`,
                  }}
                />
                <div
                  className="warning-line"
                  style={{
                    left: `${(metric.threshold.warning / metric.threshold.critical) * 100}%`,
                  }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </BaseRealTimeWidget>
  );
}

BaseRealTimeWidget.displayName = "BaseRealTimeWidget";
NetworkDeviceWidget.displayName = "NetworkDeviceWidget";
ServiceHealthWidget.displayName = "ServiceHealthWidget";
RealTimeMetricsWidget.displayName = "RealTimeMetricsWidget";

export { BaseRealTimeWidget };
