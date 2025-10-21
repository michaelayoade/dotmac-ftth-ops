"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  ChevronRight,
  Bell,
  RefreshCw,
} from "lucide-react";
import { useAlerts } from "@/hooks/useAlerts";
import { Alert, AlertSeverity } from "@/lib/services/alert-service";

interface AlertBannerProps {
  category?: string;
  maxAlerts?: number;
  collapsible?: boolean;
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    bgColor: "bg-red-950/20",
    borderColor: "border-red-900/20",
    iconColor: "text-red-400",
    textColor: "text-red-400",
  },
  warning: {
    icon: AlertCircle,
    bgColor: "bg-orange-950/20",
    borderColor: "border-orange-900/20",
    iconColor: "text-orange-400",
    textColor: "text-orange-400",
  },
  info: {
    icon: Info,
    bgColor: "bg-blue-950/20",
    borderColor: "border-blue-900/20",
    iconColor: "text-blue-400",
    textColor: "text-blue-400",
  },
  success: {
    icon: CheckCircle,
    bgColor: "bg-green-950/20",
    borderColor: "border-green-900/20",
    iconColor: "text-green-400",
    textColor: "text-green-400",
  },
};

function AlertItem({ alert, onDismiss }: { alert: Alert; onDismiss: (id: string) => void }) {
  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 ${config.iconColor}`} />
        <div className="flex-1">
          <p className={`font-medium ${config.textColor}`}>{alert.title}</p>
          <p className="mt-1 text-sm text-slate-400">{alert.message}</p>
          {alert.actionUrl && (
            <Link
              href={alert.actionUrl}
              className={`inline-flex items-center gap-1 mt-2 text-sm ${config.textColor} hover:underline`}
            >
              {alert.actionText || "View Details"}
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        <button
          onClick={() => onDismiss(alert.id)}
          className="text-slate-500 hover:text-slate-400 transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
          aria-label={`Dismiss ${alert.title} alert`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function AlertBanner({ category, maxAlerts = 3, collapsible = true }: AlertBannerProps) {
  const { alerts, dismissAlert, refreshAlerts, loading } = useAlerts();
  const [collapsed, setCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filter alerts by category if specified
  const filteredAlerts = category ? alerts.filter((alert) => alert.category === category) : alerts;

  // Sort by severity (critical first) and timestamp
  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
    if (a.severity !== b.severity) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  // Limit the number of alerts shown
  const visibleAlerts = collapsed ? [] : sortedAlerts.slice(0, maxAlerts);
  const hiddenCount = sortedAlerts.length - visibleAlerts.length;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshAlerts();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading alerts...</span>
        </div>
      </div>
    );
  }

  if (sortedAlerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {collapsible && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span>
              {collapsed
                ? `Show ${sortedAlerts.length} alert${sortedAlerts.length !== 1 ? "s" : ""}`
                : `Hide alerts`}
            </span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-slate-400 hover:text-slate-300 transition-colors"
            aria-label="Refresh alerts"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}

      {!collapsed && (
        <div className="space-y-3">
          {visibleAlerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} onDismiss={dismissAlert} />
          ))}

          {hiddenCount > 0 && (
            <div className="text-center">
              <button
                onClick={() => setCollapsed(false)}
                className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                +{hiddenCount} more alert{hiddenCount !== 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AlertSummaryWidget() {
  const { stats } = useAlerts();

  if (stats.total === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-400" />
          <div>
            <p className="font-medium text-white">All Systems Operational</p>
            <p className="text-sm text-slate-400">No active alerts</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-white">Active Alerts</h3>
        <Link
          href="/dashboard/alerts"
          className="text-sm text-sky-400 hover:text-sky-300 transition-colors"
        >
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {stats.critical > 0 && (
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm text-slate-300">{stats.critical} Critical</span>
          </div>
        )}
        {stats.warning > 0 && (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-400" />
            <span className="text-sm text-slate-300">{stats.warning} Warning</span>
          </div>
        )}
        {stats.info > 0 && (
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-slate-300">{stats.info} Info</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800">
        <div className="flex flex-wrap gap-2">
          {stats.byCategory.security > 0 && (
            <span className="text-xs px-2 py-1 bg-slate-800 rounded-full text-slate-400">
              Security: {stats.byCategory.security}
            </span>
          )}
          {stats.byCategory.billing > 0 && (
            <span className="text-xs px-2 py-1 bg-slate-800 rounded-full text-slate-400">
              Billing: {stats.byCategory.billing}
            </span>
          )}
          {stats.byCategory.performance > 0 && (
            <span className="text-xs px-2 py-1 bg-slate-800 rounded-full text-slate-400">
              Performance: {stats.byCategory.performance}
            </span>
          )}
          {stats.byCategory.system > 0 && (
            <span className="text-xs px-2 py-1 bg-slate-800 rounded-full text-slate-400">
              System: {stats.byCategory.system}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
