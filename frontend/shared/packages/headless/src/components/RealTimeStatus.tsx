/**
 * Real-Time Connection Status Component
 * Shows WebSocket connection status and quality indicator
 */

import { Wifi, WifiOff, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useRealTime } from "./RealTimeProvider";

interface RealTimeStatusProps {
  showDetails?: boolean;
  className?: string;
}

export function RealTimeStatus({ showDetails = false, className = "" }: RealTimeStatusProps) {
  const { isConnected, isConnecting, connectionQuality, error, reconnect } = useRealTime();

  const getStatusInfo = () => {
    if (error) {
      return {
        icon: AlertTriangle,
        color: "text-red-500",
        bg: "bg-red-50",
        border: "border-red-200",
        status: "Error",
        description: error,
      };
    }

    if (isConnecting) {
      return {
        icon: Clock,
        color: "text-yellow-500",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        status: "Connecting",
        description: "Establishing real-time connection...",
      };
    }

    if (!isConnected) {
      return {
        icon: WifiOff,
        color: "text-gray-500",
        bg: "bg-gray-50",
        border: "border-gray-200",
        status: "Offline",
        description: "Real-time updates unavailable",
      };
    }

    // Connected - show quality
    switch (connectionQuality) {
      case "excellent":
        return {
          icon: CheckCircle,
          color: "text-green-500",
          bg: "bg-green-50",
          border: "border-green-200",
          status: "Excellent",
          description: "Real-time updates active (< 100ms)",
        };
      case "good":
        return {
          icon: Wifi,
          color: "text-blue-500",
          bg: "bg-blue-50",
          border: "border-blue-200",
          status: "Good",
          description: "Real-time updates active (< 300ms)",
        };
      case "poor":
        return {
          icon: AlertTriangle,
          color: "text-orange-500",
          bg: "bg-orange-50",
          border: "border-orange-200",
          status: "Poor",
          description: "Slow connection (> 300ms)",
        };
      default:
        return {
          icon: WifiOff,
          color: "text-gray-500",
          bg: "bg-gray-50",
          border: "border-gray-200",
          status: "Unknown",
          description: "Connection status unknown",
        };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  if (!showDetails) {
    // Simple indicator
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="relative">
          <Icon className={`w-4 h-4 ${statusInfo.color}`} />
          {isConnected && (
            <div
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                connectionQuality === "excellent"
                  ? "bg-green-400"
                  : connectionQuality === "good"
                    ? "bg-blue-400"
                    : "bg-orange-400"
              } animate-pulse`}
            />
          )}
        </div>
        {showDetails && (
          <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.status}</span>
        )}
      </div>
    );
  }

  // Detailed status card
  return (
    <div className={`${statusInfo.bg} ${statusInfo.border} border rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Icon className={`w-5 h-5 ${statusInfo.color}`} />
          <div>
            <p className={`text-sm font-medium ${statusInfo.color}`}>
              Real-Time: {statusInfo.status}
            </p>
            <p className="text-xs text-gray-600">{statusInfo.description}</p>
          </div>
        </div>

        {error && (
          <button
            onClick={reconnect}
            className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
