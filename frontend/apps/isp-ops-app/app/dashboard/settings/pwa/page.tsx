"use client";

/**
 * PWA Settings Page
 * Manage push notifications, offline mode, and app installation
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  Bell,
  BellOff,
  Download,
  Wifi,
  WifiOff,
  Smartphone,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { usePWA } from "@/components/pwa/PWAProvider";
import { showInstallPrompt, canShowInstallPrompt } from "@/lib/pwa";

export default function PWASettingsPage() {
  const {
    isOnline,
    isInstalled,
    notificationPermission,
    requestNotifications,
    subscribeToPush,
    getPendingData,
  } = usePWA();

  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState({ timeEntries: 0, locations: 0 });

  const handleEnableNotifications = async () => {
    setLoading(true);

    try {
      const permission = await requestNotifications();

      if (permission === "granted") {
        const subscribed = await subscribeToPush();

        if (subscribed) {
          alert("Push notifications enabled!");
        } else {
          alert("Failed to subscribe to push notifications");
        }
      } else {
        alert("Notification permission denied");
      }
    } catch (error) {
      console.error("Failed to enable notifications:", error);
      alert("Failed to enable notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleInstallApp = async () => {
    if (canShowInstallPrompt()) {
      await showInstallPrompt();
    } else {
      alert("App is already installed or install prompt not available");
    }
  };

  const checkPendingData = async () => {
    try {
      const timeEntries = await getPendingData.timeEntries();
      const locations = await getPendingData.locations();

      setPendingCount({
        timeEntries: timeEntries.length,
        locations: locations.length,
      });
    } catch (error) {
      console.error("Failed to check pending data:", error);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">PWA Settings</h1>
        <p className="text-gray-600">Manage offline mode, notifications, and app installation</p>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Online Status</p>
                <p className="text-2xl font-bold mt-1">
                  {isOnline ? (
                    <Badge className="bg-green-100 text-green-800">Online</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800">Offline</Badge>
                  )}
                </p>
              </div>
              {isOnline ? (
                <Wifi className="h-8 w-8 text-green-500" />
              ) : (
                <WifiOff className="h-8 w-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">App Installation</p>
                <p className="text-2xl font-bold mt-1">
                  {isInstalled ? (
                    <Badge className="bg-green-100 text-green-800">Installed</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800">Not Installed</Badge>
                  )}
                </p>
              </div>
              <Smartphone className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Notifications</p>
                <p className="text-2xl font-bold mt-1">
                  {notificationPermission === "granted" ? (
                    <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                  ) : notificationPermission === "denied" ? (
                    <Badge className="bg-red-100 text-red-800">Denied</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800">Not Set</Badge>
                  )}
                </p>
              </div>
              {notificationPermission === "granted" ? (
                <Bell className="h-8 w-8 text-green-500" />
              ) : (
                <BellOff className="h-8 w-8 text-gray-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-medium mb-1">Enable Notifications</h3>
              <p className="text-sm text-gray-600">
                Receive real-time updates about task assignments, schedule changes, and important
                alerts.
              </p>

              {notificationPermission === "granted" && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-800">Push notifications are enabled</span>
                </div>
              )}

              {notificationPermission === "denied" && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="text-sm font-medium text-red-800">Notifications blocked</span>
                  </div>
                  <p className="text-xs text-red-700">
                    To enable notifications, you need to allow them in your browser settings.
                  </p>
                </div>
              )}
            </div>

            {notificationPermission !== "granted" && (
              <Button
                onClick={handleEnableNotifications}
                disabled={loading || notificationPermission === "denied"}
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <Bell className="mr-2 h-4 w-4" />
                    Enable
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Notification Types:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                New task assignments
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Schedule changes and updates
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Urgent alerts and messages
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Time entry approval status
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* App Installation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            App Installation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-medium mb-1">Install as App</h3>
              <p className="text-sm text-gray-600 mb-3">
                Install dotmac Ops on your device for faster access, offline support, and a native
                app experience.
              </p>

              {isInstalled ? (
                <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-800">App is installed</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Benefits:</div>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li className="flex items-center gap-2">⚡ Faster load times</li>
                    <li className="flex items-center gap-2">📱 Home screen icon</li>
                    <li className="flex items-center gap-2">🔔 Push notifications</li>
                    <li className="flex items-center gap-2">✈️ Offline mode support</li>
                  </ul>
                </div>
              )}
            </div>

            {!isInstalled && (
              <Button onClick={handleInstallApp}>
                <Download className="mr-2 h-4 w-4" />
                Install App
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Offline Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            Offline Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-1">Background Sync</h3>
            <p className="text-sm text-gray-600 mb-3">
              When offline, your actions are saved locally and automatically synced when you
              reconnect.
            </p>

            <Button variant="outline" size="sm" onClick={checkPendingData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Check Pending Data
            </Button>

            {(pendingCount.timeEntries > 0 || pendingCount.locations > 0) && (
              <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                <div className="text-sm font-medium text-yellow-900 mb-1">Pending Sync:</div>
                <ul className="text-sm text-yellow-800 space-y-1">
                  {pendingCount.timeEntries > 0 && <li>{pendingCount.timeEntries} time entries</li>}
                  {pendingCount.locations > 0 && <li>{pendingCount.locations} location updates</li>}
                </ul>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Available Offline:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Clock in/out (syncs when online)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                View cached task assignments
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                View recent time entries
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Update location (syncs when online)
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
