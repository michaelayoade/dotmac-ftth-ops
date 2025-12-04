"use client";

/**
 * Offline Fallback Page
 * Displayed when the app is offline and no cached version is available
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { WifiOff, RefreshCw, Clock, CheckCircle2 } from "lucide-react";
import { usePWA } from "@/components/pwa/PWAProvider";

export default function OfflinePage() {
  const [isChecking, setIsChecking] = useState(false);
  const { isOnline, getPendingData } = usePWA();
  const [pendingCount, setPendingCount] = useState({ timeEntries: 0, locations: 0 });

  const loadPendingData = useCallback(async () => {
    try {
      const [timeEntries, locations] = await Promise.all([
        getPendingData.timeEntries(),
        getPendingData.locations(),
      ]);
      setPendingCount({
        timeEntries: timeEntries.length,
        locations: locations.length,
      });
    } catch (error) {
      console.error("Failed to load pending data:", error);
    }
  }, [getPendingData]);

  useEffect(() => {
    loadPendingData();
  }, [loadPendingData]);

  const handleRetry = async () => {
    setIsChecking(true);

    // Wait a moment to check connection
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (navigator.onLine) {
      window.location.reload();
    } else {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (isOnline) {
      window.location.reload();
    }
  }, [isOnline]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-20 w-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <WifiOff className="h-10 w-10 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl">You&apos;re Offline</CardTitle>
          <p className="text-muted-foreground mt-2">
            No internet connection detected. Please check your network settings.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Pending Data Status */}
          {(pendingCount.timeEntries > 0 || pendingCount.locations > 0) && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-yellow-900 dark:text-yellow-100 text-sm">
                    Pending Sync
                  </h3>
                  <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                    {pendingCount.timeEntries > 0 && (
                      <span className="block">
                        {pendingCount.timeEntries} time{" "}
                        {pendingCount.timeEntries === 1 ? "entry" : "entries"}
                      </span>
                    )}
                    {pendingCount.locations > 0 && (
                      <span className="block">
                        {pendingCount.locations} location{" "}
                        {pendingCount.locations === 1 ? "update" : "updates"}
                      </span>
                    )}
                  </p>
                  <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">
                    Will sync automatically when you reconnect
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* What You Can Do */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">While Offline You Can:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                View cached pages and data
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Clock in/out (syncs when online)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                View your schedule
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <Button onClick={handleRetry} disabled={isChecking} className="w-full" size="lg">
              {isChecking ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Checking Connection...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Connection
                </>
              )}
            </Button>

            <Button onClick={() => window.history.back()} variant="outline" className="w-full">
              Go Back
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-xs text-center text-muted-foreground pt-2 border-t">
            <p>This page will automatically reload when your connection is restored.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
