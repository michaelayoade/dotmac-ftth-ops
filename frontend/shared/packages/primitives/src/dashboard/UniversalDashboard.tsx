/**
 * Universal Dashboard Component
 * Provides consistent dashboard layout patterns across all portal variants
 */

"use client";

import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "../utils/cn";

export interface DashboardVariant {
  admin: {
    primaryColor: "#0F172A";
    accentColor: "#3B82F6";
    gradientFrom: "from-blue-600";
    gradientTo: "to-indigo-700";
  };
  customer: {
    primaryColor: "#059669";
    accentColor: "#10B981";
    gradientFrom: "from-emerald-600";
    gradientTo: "to-teal-700";
  };
  reseller: {
    primaryColor: "#7C3AED";
    accentColor: "#8B5CF6";
    gradientFrom: "from-violet-600";
    gradientTo: "to-purple-700";
  };
  technician: {
    primaryColor: "#DC2626";
    accentColor: "#EF4444";
    gradientFrom: "from-red-600";
    gradientTo: "to-rose-700";
  };
  management: {
    primaryColor: "#EA580C";
    accentColor: "#F97316";
    gradientFrom: "from-orange-600";
    gradientTo: "to-amber-700";
  };
}

export interface DashboardUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
}

export interface DashboardTenant {
  id: string;
  name: string;
  companyName?: string;
  plan?: string;
  status?: "active" | "trial" | "suspended" | "inactive";
  trialDaysLeft?: number;
}

export interface DashboardHeaderAction {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

export interface UniversalDashboardProps {
  variant: keyof DashboardVariant;
  user?: DashboardUser;
  tenant?: DashboardTenant;
  title: string;
  subtitle?: string;
  actions?: DashboardHeaderAction[];
  children: ReactNode;

  // Loading & Error States
  isLoading?: boolean;
  error?: Error | string | null;
  onRefresh?: () => void;
  loadingMessage?: string;
  emptyStateMessage?: string;

  // Layout Options
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "full";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  spacing?: "tight" | "normal" | "relaxed";

  // Header Options
  showGradientHeader?: boolean;
  showUserInfo?: boolean;
  showTenantInfo?: boolean;
  className?: string;
}

const variantStyles: DashboardVariant = {
  admin: {
    primaryColor: "#0F172A",
    accentColor: "#3B82F6",
    gradientFrom: "from-blue-600",
    gradientTo: "to-indigo-700",
  },
  customer: {
    primaryColor: "#059669",
    accentColor: "#10B981",
    gradientFrom: "from-emerald-600",
    gradientTo: "to-teal-700",
  },
  reseller: {
    primaryColor: "#7C3AED",
    accentColor: "#8B5CF6",
    gradientFrom: "from-violet-600",
    gradientTo: "to-purple-700",
  },
  technician: {
    primaryColor: "#DC2626",
    accentColor: "#EF4444",
    gradientFrom: "from-red-600",
    gradientTo: "to-rose-700",
  },
  management: {
    primaryColor: "#EA580C",
    accentColor: "#F97316",
    gradientFrom: "from-orange-600",
    gradientTo: "to-amber-700",
  },
};

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

const paddingClasses = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
  xl: "p-12",
};

const spacingClasses = {
  tight: "space-y-4",
  normal: "space-y-6",
  relaxed: "space-y-8",
};

export function UniversalDashboard({
  variant,
  user,
  tenant,
  title,
  subtitle,
  actions = [],
  children,
  isLoading = false,
  error = null,
  onRefresh,
  loadingMessage = "Loading dashboard...",
  emptyStateMessage = "No data available",
  maxWidth = "7xl",
  padding = "md",
  spacing = "normal",
  showGradientHeader = true,
  showUserInfo = true,
  showTenantInfo = true,
  className = "",
}: UniversalDashboardProps) {
  const styles = variantStyles[variant];
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className={cn("min-h-screen bg-gray-50", className)}>
        <div className={cn("mx-auto", maxWidthClasses[maxWidth], paddingClasses[padding])}>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <motion.div
                className="inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <p className="mt-4 text-gray-600">{loadingMessage}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    const errorMessage = typeof error === "string" ? error : error.message;
    return (
      <div className={cn("min-h-screen bg-gray-50", className)}>
        <div className={cn("mx-auto", maxWidthClasses[maxWidth], paddingClasses[padding])}>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
              <p className="text-gray-600 mb-4">{errorMessage}</p>
              {onRefresh && (
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center space-x-2"
                >
                  <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                  <span>Try Again</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-gray-50", className)}>
      <div className={cn("mx-auto", maxWidthClasses[maxWidth])}>
        {/* Dashboard Header */}
        {showGradientHeader && (
          <motion.div
            className={cn(
              "rounded-lg bg-gradient-to-r text-white mb-6",
              styles.gradientFrom,
              styles.gradientTo,
              paddingClasses[padding],
            )}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-bold text-2xl">{title}</h1>
                {subtitle && <p className="mt-1 opacity-90 text-sm">{subtitle}</p>}

                {/* User & Tenant Info */}
                <div className="mt-3 flex items-center space-x-6">
                  {showUserInfo && user && (
                    <div className="flex items-center space-x-2">
                      {user.avatar && (
                        <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full" />
                      )}
                      <span className="text-sm opacity-75">
                        {user.name} {user.role && `• ${user.role}`}
                      </span>
                    </div>
                  )}

                  {showTenantInfo && tenant && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm opacity-75">
                        {tenant.companyName || tenant.name}
                        {tenant.plan && ` • ${tenant.plan}`}
                      </span>
                      {tenant.status && tenant.status !== "active" && (
                        <span
                          className={cn(
                            "px-2 py-1 text-xs font-medium rounded-full",
                            tenant.status === "trial" && "bg-yellow-500/20 text-yellow-100",
                            tenant.status === "suspended" && "bg-red-500/20 text-red-100",
                            tenant.status === "inactive" && "bg-gray-500/20 text-gray-100",
                          )}
                        >
                          {tenant.status}
                          {tenant.trialDaysLeft &&
                            tenant.status === "trial" &&
                            ` (${tenant.trialDaysLeft} days left)`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Header Actions */}
              {actions.length > 0 && (
                <div className="flex items-center space-x-3">
                  {actions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        onClick={action.onClick}
                        className={cn(
                          "inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          action.variant === "primary" &&
                            "bg-white/20 hover:bg-white/30 text-white",
                          action.variant === "secondary" &&
                            "bg-white/10 hover:bg-white/20 text-white",
                          (!action.variant || action.variant === "outline") &&
                            "border border-white/30 hover:bg-white/10 text-white",
                          action.variant === "ghost" && "hover:bg-white/10 text-white",
                        )}
                      >
                        {Icon && <Icon className="w-4 h-4 mr-2" />}
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Dashboard Content */}
        <div className={cn(paddingClasses[padding])}>
          <motion.div
            className={spacingClasses[spacing]}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default UniversalDashboard;
