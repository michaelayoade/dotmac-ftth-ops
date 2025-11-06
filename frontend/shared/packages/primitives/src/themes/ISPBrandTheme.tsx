/**
 * ISP Brand Theme System
 * Centralized theme configuration with ISP-specific branding elements
 */

"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { cn } from "../utils/cn";

// Brand Colors - ISP specific color palette
export const ISPColors = {
  // Primary Brand Colors
  primary: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6", // Main brand blue
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
  },
  // Network/Connection Green
  network: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e", // Signal strength green
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
  },
  // Warning/Alert Orange
  alert: {
    50: "#fff7ed",
    100: "#ffedd5",
    200: "#fed7aa",
    300: "#fdba74",
    400: "#fb923c",
    500: "#f97316", // Warning orange
    600: "#ea580c",
    700: "#c2410c",
    800: "#9a3412",
    900: "#7c2d12",
  },
  // Critical/Error Red
  critical: {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444", // Error red
    600: "#dc2626",
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
  },
};

// ISP-specific gradients
export const ISPGradients = {
  primary: "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600",
  network: "bg-gradient-to-r from-green-500 to-emerald-500",
  signal: "bg-gradient-to-r from-green-400 via-blue-500 to-purple-600",
  speed: "bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600",
  data: "bg-gradient-to-r from-purple-400 via-pink-500 to-red-500",
  billing: "bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500",
  premium: "bg-gradient-to-r from-purple-600 via-pink-600 to-red-600",
  enterprise: "bg-gradient-to-r from-gray-900 via-purple-900 to-indigo-900",
};

// ISP Brand Icons & Symbols
export const ISPIcons = {
  // Network symbols
  signal: "📶",
  wifi: "📡",
  network: "🌐",
  connection: "🔗",
  speed: "⚡",

  // Service symbols
  fiber: "🔥",
  broadband: "💨",
  phone: "📞",
  tv: "📺",

  // Status symbols
  online: "🟢",
  offline: "🔴",
  warning: "⚠️",
  excellent: "⭐",
  maintenance: "🔧",

  // Business symbols
  billing: "💳",
  payment: "💰",
  report: "📊",
  analytics: "📈",

  // Support symbols
  support: "🎧",
  ticket: "🎫",
  help: "❓",
  chat: "💬",
};

// Theme configuration
interface ISPThemeConfig {
  portal: "admin" | "customer" | "reseller";
  density: "compact" | "comfortable" | "spacious";
  accentColor: keyof typeof ISPColors;
  showBrandElements: boolean;
  animationsEnabled: boolean;
}

const defaultThemeConfig: ISPThemeConfig = {
  portal: "admin",
  density: "comfortable",
  accentColor: "primary",
  showBrandElements: true,
  animationsEnabled: true,
};

const ISPThemeContext = createContext<ISPThemeConfig>(defaultThemeConfig);

// Theme Provider Component
interface ISPThemeProviderProps {
  children: ReactNode;
  config?: Partial<ISPThemeConfig>;
}

export function ISPThemeProvider({ children, config = {} }: ISPThemeProviderProps) {
  const themeConfig = { ...defaultThemeConfig, ...config };

  return (
    <ISPThemeContext.Provider value={themeConfig}>
      <div
        className={cn(
          "min-h-screen transition-all duration-300",
          themeConfig.portal === "admin" && "bg-gray-50",
          themeConfig.portal === "customer" && "bg-gradient-to-br from-blue-50 to-indigo-50",
          themeConfig.portal === "reseller" && "bg-gradient-to-br from-purple-50 to-pink-50",
        )}
        data-portal={themeConfig.portal}
        data-density={themeConfig.density}
        data-animations={themeConfig.animationsEnabled}
      >
        {children}
      </div>
    </ISPThemeContext.Provider>
  );
}

// Hook to use theme
export function useISPTheme() {
  return useContext(ISPThemeContext);
}

// Brand Header Component
interface ISPBrandHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  gradient?: keyof typeof ISPGradients;
  className?: string;
}

export function ISPBrandHeader({
  title,
  subtitle,
  icon,
  gradient = "primary",
  className,
}: ISPBrandHeaderProps) {
  const theme = useISPTheme();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg p-8 text-white shadow-lg",
        ISPGradients[gradient],
        className,
      )}
    >
      <div className="relative z-10 flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            {icon && <span className="text-3xl">{icon}</span>}
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          </div>
          {subtitle && <p className="text-lg opacity-90">{subtitle}</p>}
        </div>
        {theme.showBrandElements && (
          <div className="hidden md:flex space-x-2 opacity-20">
            <span className="text-6xl">{ISPIcons.network}</span>
            <span className="text-6xl">{ISPIcons.signal}</span>
            <span className="text-6xl">{ISPIcons.speed}</span>
          </div>
        )}
      </div>

      {/* Decorative elements */}
      {theme.showBrandElements && (
        <>
          <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10"></div>
          <div className="absolute bottom-0 left-0 -mb-6 -ml-6 h-32 w-32 rounded-full bg-white/5"></div>
        </>
      )}
    </div>
  );
}

// Service Tier Badge Component
interface ServiceTierBadgeProps {
  tier: "basic" | "standard" | "premium" | "enterprise";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ServiceTierBadge({ tier, size = "md", className }: ServiceTierBadgeProps) {
  const tierConfig = {
    basic: {
      label: "Basic",
      icon: ISPIcons.broadband,
      gradient: "bg-gradient-to-r from-gray-500 to-gray-600",
      glow: "shadow-gray-500/25",
    },
    standard: {
      label: "Standard",
      icon: ISPIcons.wifi,
      gradient: "bg-gradient-to-r from-blue-500 to-indigo-600",
      glow: "shadow-blue-500/25",
    },
    premium: {
      label: "Premium",
      icon: ISPIcons.fiber,
      gradient: ISPGradients.premium,
      glow: "shadow-purple-500/25",
    },
    enterprise: {
      label: "Enterprise",
      icon: ISPIcons.network,
      gradient: ISPGradients.enterprise,
      glow: "shadow-purple-500/50",
    },
  };

  const config = tierConfig[tier];
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-3 text-base",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center space-x-1 rounded-full font-semibold text-white shadow-lg",
        config.gradient,
        config.glow,
        sizeClasses[size],
        className,
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

// Network Status Indicator
interface NetworkStatusProps {
  status: "excellent" | "good" | "fair" | "poor" | "offline";
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

export function NetworkStatusIndicator({
  status,
  showLabel = true,
  animated = true,
  className,
}: NetworkStatusProps) {
  const statusConfig = {
    excellent: {
      icon: ISPIcons.excellent,
      color: "text-green-500",
      label: "Excellent Signal",
      bars: 4,
    },
    good: {
      icon: ISPIcons.online,
      color: "text-blue-500",
      label: "Good Signal",
      bars: 3,
    },
    fair: {
      icon: ISPIcons.warning,
      color: "text-yellow-500",
      label: "Fair Signal",
      bars: 2,
    },
    poor: {
      icon: ISPIcons.warning,
      color: "text-orange-500",
      label: "Poor Signal",
      bars: 1,
    },
    offline: {
      icon: ISPIcons.offline,
      color: "text-red-500",
      label: "Offline",
      bars: 0,
    },
  };

  const config = statusConfig[status];

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      {/* Signal Bars */}
      <div className="flex items-end space-x-1">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={cn(
              "w-1 rounded-full transition-all duration-300",
              bar <= config.bars
                ? cn(config.color.replace("text-", "bg-"), animated && "animate-pulse")
                : "bg-gray-300",
              bar === 1 && "h-2",
              bar === 2 && "h-3",
              bar === 3 && "h-4",
              bar === 4 && "h-5",
            )}
          />
        ))}
      </div>

      {/* Status Icon & Label */}
      <div className="flex items-center space-x-1">
        <span className={cn("text-lg", animated && status !== "offline" && "animate-pulse")}>
          {config.icon}
        </span>
        {showLabel && (
          <span className={cn("text-sm font-medium", config.color)}>{config.label}</span>
        )}
      </div>
    </div>
  );
}

// Speed Test Gauge Component
interface SpeedGaugeProps {
  speed: number;
  maxSpeed: number;
  unit?: string;
  label?: string;
  className?: string;
}

export function SpeedGauge({
  speed,
  maxSpeed,
  unit = "Mbps",
  label = "Speed",
  className,
}: SpeedGaugeProps) {
  const percentage = Math.min((speed / maxSpeed) * 100, 100);
  const speedRating =
    percentage > 80 ? "excellent" : percentage > 60 ? "good" : percentage > 40 ? "fair" : "poor";

  const ratingConfig = {
    excellent: {
      color: "text-green-500",
      bgColor: "bg-green-500",
      icon: ISPIcons.speed,
    },
    good: {
      color: "text-blue-500",
      bgColor: "bg-blue-500",
      icon: ISPIcons.wifi,
    },
    fair: {
      color: "text-yellow-500",
      bgColor: "bg-yellow-500",
      icon: ISPIcons.warning,
    },
    poor: {
      color: "text-red-500",
      bgColor: "bg-red-500",
      icon: ISPIcons.offline,
    },
  };

  const config = ratingConfig[speedRating];

  return (
    <div className={cn("text-center space-y-3", className)}>
      {/* Circular Progress */}
      <div className="relative w-24 h-24 mx-auto">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 32 32">
          <circle
            cx="16"
            cy="16"
            r="14"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx="16"
            cy="16"
            r="14"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeDasharray={`${percentage} ${100 - percentage}`}
            strokeDashoffset="25"
            className={config.color}
            style={{ transition: "stroke-dasharray 1s ease-in-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className={cn("text-lg font-bold", config.color)}>{speed}</div>
            <div className="text-xs text-gray-500">{unit}</div>
          </div>
        </div>
      </div>

      {/* Label & Status */}
      <div className="space-y-1">
        <div className="flex items-center justify-center space-x-1">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-lg">{config.icon}</span>
        </div>
        <div className={cn("text-xs font-medium capitalize", config.color)}>{speedRating}</div>
      </div>
    </div>
  );
}

// Export theme utilities
export const ISPThemeUtils = {
  getPortalGradient: (portal: string) => {
    switch (portal) {
      case "admin":
        return ISPGradients.primary;
      case "customer":
        return ISPGradients.network;
      case "reseller":
        return ISPGradients.premium;
      default:
        return ISPGradients.primary;
    }
  },

  getServiceIcon: (serviceType: string) => {
    switch (serviceType.toLowerCase()) {
      case "fiber":
        return ISPIcons.fiber;
      case "broadband":
        return ISPIcons.broadband;
      case "phone":
        return ISPIcons.phone;
      case "tv":
        return ISPIcons.tv;
      case "internet":
        return ISPIcons.wifi;
      default:
        return ISPIcons.network;
    }
  },

  getStatusIcon: (status: string) => {
    switch (status.toLowerCase()) {
      case "online":
      case "active":
      case "connected":
        return ISPIcons.online;
      case "offline":
      case "inactive":
      case "disconnected":
        return ISPIcons.offline;
      case "warning":
      case "degraded":
        return ISPIcons.warning;
      case "maintenance":
        return ISPIcons.maintenance;
      case "excellent":
        return ISPIcons.excellent;
      default:
        return ISPIcons.network;
    }
  },
};
