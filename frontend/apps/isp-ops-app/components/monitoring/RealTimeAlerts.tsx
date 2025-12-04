"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, X, AlertCircle, WifiOff, Wifi } from "lucide-react";
import { useWebSocket, useNetworkMonitoring } from "@/lib/websocket/hooks";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";

export function RealTimeAlerts() {
  const { connectionState, isConnected, isReconnecting } = useWebSocket();

  const { alerts, deviceUpdates, lastUpdate, clearAlerts, dismissAlert } = useNetworkMonitoring();

  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);

  // Play sound for critical alerts
  useEffect(() => {
    if (soundEnabled && alerts.length > 0 && alerts[0].severity === "critical") {
      // Play notification sound (you would need to add an actual sound file)
      // const audio = new Audio('/sounds/alert.mp3');
      // audio.play().catch(() => {});
    }
  }, [alerts, soundEnabled]);

  const criticalAlerts = alerts.filter((a) => a.severity === "critical");
  const warningAlerts = alerts.filter((a) => a.severity === "warning");
  const infoAlerts = alerts.filter((a) => a.severity === "info");

  return (
    <div className="space-y-4">
      {/* Connection Status Banner */}
      {!isConnected && (
        <Alert variant={isReconnecting ? "default" : "destructive"}>
          {isReconnecting ? (
            <>
              <Wifi className="h-4 w-4 animate-pulse" />
              <AlertTitle>Reconnecting...</AlertTitle>
              <AlertDescription>
                WebSocket connection lost. Attempting to reconnect...
              </AlertDescription>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4" />
              <AlertTitle>Disconnected</AlertTitle>
              <AlertDescription>
                Real-time monitoring is not available. {connectionState.error}
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Real-Time Alerts
                {isConnected && (
                  <Badge variant="outline" className="ml-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse" />
                    Live
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {lastUpdate
                  ? `Last update: ${lastUpdate.toLocaleTimeString()}`
                  : "Waiting for updates..."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSoundEnabled(!soundEnabled)}>
                {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAlerts}
                disabled={alerts.length === 0}
              >
                Clear All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1">
              <Badge variant="destructive">{criticalAlerts.length}</Badge>
              <span className="text-muted-foreground">Critical</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="secondary">{warningAlerts.length}</Badge>
              <span className="text-muted-foreground">Warning</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline">{infoAlerts.length}</Badge>
              <span className="text-muted-foreground">Info</span>
            </div>
          </div>

          {/* Alerts List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No alerts at this time</div>
            ) : (
              alerts.map((alert, index) => (
                <Alert
                  key={alert.id || index}
                  variant={
                    alert.severity === "critical" || alert.severity === "error"
                      ? "destructive"
                      : "default"
                  }
                  className="relative"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{alert.title || "Network Alert"}</span>
                      <Badge variant="outline" className="text-xs">
                        {alert.severity}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissAlert(alert.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </AlertTitle>
                  <AlertDescription>
                    {alert.message}
                    {alert.device_name && (
                      <div className="text-xs mt-1 text-muted-foreground">
                        Device: {alert.device_name}
                      </div>
                    )}
                    {alert.timestamp && (
                      <div className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Device Updates */}
      {deviceUpdates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Device Updates</CardTitle>
            <CardDescription>Latest status changes and metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {deviceUpdates.slice(0, 10).map((update, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded-lg border border-border/60 bg-card/40"
                >
                  <div>
                    <div className="font-medium text-sm">
                      {update.device_name || update.device_id}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {update.status_change
                        ? `Status: ${update.old_status} → ${update.new_status}`
                        : update.message || "Metrics updated"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {update.timestamp && new Date(update.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
