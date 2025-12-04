"use client";

import { Alert, AlertDescription, AlertTitle, Badge, Button } from "@dotmac/ui";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface Option82Alert {
  id: string;
  subscriberId: string;
  subscriberUsername?: string | null;
  severity: string;
  alertType: string;
  message: string;
  expectedCircuitId?: string | null;
  actualCircuitId?: string | null;
  expectedRemoteId?: string | null;
  actualRemoteId?: string | null;
  triggeredAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  isActive: boolean;
}

interface Option82AlertBannerProps {
  alerts: Option82Alert[];
  onAcknowledge?: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
}

export function Option82AlertBanner({
  alerts,
  onAcknowledge,
  onResolve,
}: Option82AlertBannerProps) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  const activeAlerts = alerts.filter((alert) => alert.isActive);

  if (activeAlerts.length === 0) {
    return null;
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
      case "error":
        return <XCircle className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      case "info":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getSeverityVariant = (severity: string): "default" | "destructive" => {
    switch (severity.toLowerCase()) {
      case "critical":
      case "error":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-2">
      {activeAlerts.map((alert) => (
        <Alert key={alert.id} variant={getSeverityVariant(alert.severity)} className="border-l-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2 flex-1">
              {getSeverityIcon(alert.severity)}
              <div className="flex-1">
                <AlertTitle className="flex items-center gap-2">
                  Option 82 Mismatch Detected
                  <Badge variant="outline" className="ml-2">
                    {alert.severity.toUpperCase()}
                  </Badge>
                </AlertTitle>
                <AlertDescription className="mt-2 space-y-2">
                  <p>{alert.message}</p>

                  {(alert.expectedCircuitId || alert.actualCircuitId) && (
                    <div className="grid grid-cols-2 gap-2 text-sm bg-muted/50 p-2 rounded">
                      <div>
                        <p className="font-semibold">Expected Circuit ID:</p>
                        <p className="font-mono">{alert.expectedCircuitId || "N/A"}</p>
                      </div>
                      <div>
                        <p className="font-semibold">Actual Circuit ID:</p>
                        <p className="font-mono">{alert.actualCircuitId || "N/A"}</p>
                      </div>
                    </div>
                  )}

                  {(alert.expectedRemoteId || alert.actualRemoteId) && (
                    <div className="grid grid-cols-2 gap-2 text-sm bg-muted/50 p-2 rounded">
                      <div>
                        <p className="font-semibold">Expected Remote ID:</p>
                        <p className="font-mono">{alert.expectedRemoteId || "N/A"}</p>
                      </div>
                      <div>
                        <p className="font-semibold">Actual Remote ID:</p>
                        <p className="font-mono">{alert.actualRemoteId || "N/A"}</p>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Triggered at: {new Date(alert.triggeredAt).toLocaleString()}
                  </p>
                </AlertDescription>
              </div>
            </div>

            <div className="flex gap-2 ml-4">
              {!alert.acknowledgedAt && onAcknowledge && (
                <Button size="sm" variant="outline" onClick={() => onAcknowledge(alert.id)}>
                  Acknowledge
                </Button>
              )}
              {onResolve && (
                <Button size="sm" variant="outline" onClick={() => onResolve(alert.id)}>
                  Resolve
                </Button>
              )}
            </div>
          </div>
        </Alert>
      ))}
    </div>
  );
}
