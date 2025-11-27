"use client";

import { Alert, AlertDescription, AlertTitle, Badge, Card, CardContent } from "@dotmac/ui";
import { AlertTriangle, CheckCircle, XCircle, Info, AlertCircle } from "lucide-react";

interface SubscriberAlert {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  timestamp?: string | null;
  count?: number;
  [key: string]: any;
}

interface SubscriberAlertsBannerProps {
  alerts: SubscriberAlert[];
}

export function SubscriberAlertsBanner({ alerts }: SubscriberAlertsBannerProps) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return <XCircle className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      case "info":
        return <Info className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getSeverityVariant = (severity: string): "default" | "destructive" => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "destructive";
      default:
        return "default";
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "info":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Group alerts by severity
  const alertsBySeverity = {
    critical: alerts.filter((a) => a.severity === "critical"),
    warning: alerts.filter((a) => a.severity === "warning"),
    info: alerts.filter((a) => a.severity === "info"),
  };

  return (
    <div className="space-y-4">
      {/* Alert Summary */}
      {alerts.length > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Alert Summary</span>
              <div className="flex gap-2">
                {alertsBySeverity.critical.length > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    {alertsBySeverity.critical.length} Critical
                  </Badge>
                )}
                {alertsBySeverity.warning.length > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-yellow-100 text-yellow-800 border-yellow-200"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {alertsBySeverity.warning.length} Warning
                  </Badge>
                )}
                {alertsBySeverity.info.length > 0 && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                    <Info className="h-3 w-3 mr-1" />
                    {alertsBySeverity.info.length} Info
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Alerts */}
      <div className="space-y-2">
        {alerts.map((alert) => (
          <Alert key={alert.id} variant={getSeverityVariant(alert.severity)} className="border-l-4">
            <div className="flex items-start gap-3">
              {getSeverityIcon(alert.severity)}
              <div className="flex-1 space-y-2">
                <AlertTitle className="flex items-center gap-2">
                  {alert.title}
                  <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                  {alert.type && (
                    <Badge variant="outline" className="text-xs">
                      {alert.type.replace(/_/g, " ").toUpperCase()}
                    </Badge>
                  )}
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{alert.message}</p>
                  {alert.count !== undefined && (
                    <p className="text-sm font-semibold">Occurrence count: {alert.count}</p>
                  )}
                  {alert.timestamp && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        ))}
      </div>
    </div>
  );
}
