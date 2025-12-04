"use client";

/**
 * Real-Time Connection Status Indicator
 *
 * Displays the current status of all realtime connections (SSE and WebSocket)
 * with visual indicators and connection details.
 */

import { useState, type ReactNode } from "react";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Card } from "@dotmac/ui";
import { Activity, AlertCircle, CheckCircle, RefreshCw, Wifi, WifiOff, X } from "lucide-react";
import { useRealtimeHealth } from "../../hooks/useRealtime";
import type { ConnectionStatus } from "../../types/realtime";
import { PulseIndicator } from "@dotmac/primitives";

export interface ConnectionStatusIndicatorProps {
  /**
   * Show detailed connection status for all endpoints
   */
  showDetails?: boolean;
  /**
   * Position of the indicator
   */
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  /**
   * Show as inline component (not floating)
   */
  inline?: boolean;
}

export function ConnectionStatusIndicator({
  showDetails: initialShowDetails = false,
  position = "bottom-right",
  inline = false,
}: ConnectionStatusIndicatorProps) {
  const [showDetails, setShowDetails] = useState(initialShowDetails);
  const { overallStatus, statuses, allConnected, anyError } = useRealtimeHealth();

  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
  };

  return (
    <div className={inline ? "" : `fixed ${positionClasses[position]} z-50 transition-all`}>
      {/* Compact Status Badge */}
      <div
        className={`flex items-center gap-2 ${showDetails ? "mb-2" : ""}`}
        onClick={() => !showDetails && setShowDetails(true)}
        role="button"
        tabIndex={0}
      >
        <StatusBadge status={overallStatus} showLabel />
      </div>

      {/* Detailed Status Card */}
      {showDetails && (
        <Card className="p-4 shadow-lg min-w-[300px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Real-Time Connections
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setShowDetails(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <ConnectionRow
              label="ONU Status"
              status={statuses.onu}
              description="Device status updates"
            />
            <ConnectionRow
              label="Alerts"
              status={statuses.alerts}
              description="System and network alerts"
            />
            <ConnectionRow
              label="Tickets"
              status={statuses.tickets}
              description="Support ticket updates"
            />
            <ConnectionRow
              label="Subscribers"
              status={statuses.subscribers}
              description="Subscriber lifecycle events"
            />
            <ConnectionRow
              label="RADIUS Sessions"
              status={statuses.sessions}
              description="Authentication sessions"
            />
          </div>

          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Overall Status</span>
              <StatusBadge status={overallStatus} />
            </div>
          </div>

          {anyError && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-900">
              <div className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                <span className="font-semibold">Connection Issue</span>
              </div>
              <p className="mt-1">
                Some real-time features may not be available. Check your network connection.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/**
 * Status Badge Component
 */
const PulseWrapper = ({ active, children }: { active: boolean; children: ReactNode }) => (
  <div
    data-testid="pulse-indicator"
    data-active={String(active)}
    className="inline-flex items-center"
  >
    <PulseIndicator active={active}>{children}</PulseIndicator>
  </div>
);

function StatusBadge({
  status,
  showLabel = false,
}: {
  status: ConnectionStatus;
  showLabel?: boolean;
}) {
  const config = {
    connected: {
      icon: CheckCircle,
      color: "bg-green-500",
      textColor: "text-green-700",
      label: "Connected",
    },
    connecting: {
      icon: RefreshCw,
      color: "bg-yellow-500",
      textColor: "text-yellow-700",
      label: "Connecting",
      animate: "animate-spin",
    },
    reconnecting: {
      icon: RefreshCw,
      color: "bg-yellow-500",
      textColor: "text-yellow-700",
      label: "Reconnecting",
      animate: "animate-spin",
    },
    disconnected: {
      icon: WifiOff,
      color: "bg-gray-500",
      textColor: "text-gray-700",
      label: "Disconnected",
    },
    error: {
      icon: AlertCircle,
      color: "bg-red-500",
      textColor: "text-red-700",
      label: "Error",
    },
  };

  const configItem = config[status];
  const { icon: Icon, color, textColor, label } = configItem;
  const animate = "animate" in configItem ? configItem.animate : "";

  if (!showLabel) {
    return (
      <PulseWrapper active={status === "connected"}>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-full ${color} text-white cursor-pointer hover:opacity-90 transition-opacity`}
        >
          <Icon className={`h-3 w-3 ${animate || ""}`} />
        </div>
      </PulseWrapper>
    );
  }

  return (
    <PulseWrapper active={status === "connected"}>
      <Badge className={`${color} text-white flex items-center gap-1`}>
        <Icon className={`h-3 w-3 ${animate || ""}`} />
        <span className="text-xs font-medium">{label}</span>
      </Badge>
    </PulseWrapper>
  );
}

/**
 * Connection Row Component
 */
function ConnectionRow({
  label,
  status,
  description,
}: {
  label: string;
  status: ConnectionStatus;
  description: string;
}) {
  const isConnected = status === "connected";
  const isError = status === "error";
  const isConnecting = status === "connecting" || status === "reconnecting";

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <PulseWrapper active={isConnected}>
            {isConnected && <Wifi className="h-3 w-3 text-green-500" />}
            {isError && <AlertCircle className="h-3 w-3 text-red-500" />}
            {isConnecting && <RefreshCw className="h-3 w-3 text-yellow-500 animate-spin" />}
            {status === "disconnected" && <WifiOff className="h-3 w-3 text-gray-500" />}
          </PulseWrapper>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

/**
 * Compact inline status indicator
 */
export function CompactConnectionStatus() {
  const { overallStatus, allConnected } = useRealtimeHealth();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {allConnected ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-yellow-500" />
        )}
        <span className="text-sm text-muted-foreground">
          {allConnected ? "Live" : "Connecting"}
        </span>
      </div>
    </div>
  );
}
