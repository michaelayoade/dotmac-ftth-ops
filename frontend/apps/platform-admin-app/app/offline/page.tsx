"use client";

/**
 * Offline Fallback Page - Platform Admin
 * Displayed when the admin panel is offline and no cached version is available
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { WifiOff, RefreshCw, CheckCircle2, Server } from "lucide-react";
import { usePWA } from "@/components/pwa/PWAProvider";

export default function OfflinePage() {
  const [isChecking, setIsChecking] = useState(false);
  const { isOnline } = usePWA();

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-20 w-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
            <WifiOff className="h-10 w-10 text-slate-600 dark:text-slate-400" />
          </div>
          <CardTitle className="text-2xl">Connection Lost</CardTitle>
          <p className="text-muted-foreground mt-2">
            Unable to reach the platform servers. Please check your connection.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Cached Data Available */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Server className="h-5 w-5 text-blue-600 dark:text-blue-500 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 text-sm">
                  Limited Functionality
                </h3>
                <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                  Some admin features require an internet connection.
                </p>
              </div>
            </div>
          </div>

          {/* What Works Offline */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Available Offline:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                View cached dashboard data
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Browse recent audit logs
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Review tenant information
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <Button
              onClick={handleRetry}
              disabled={isChecking}
              className="w-full"
              size="lg"
            >
              {isChecking ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Reconnecting...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Connection
                </>
              )}
            </Button>

            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="w-full"
            >
              Go Back
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-xs text-center text-muted-foreground pt-2 border-t">
            <p>
              This page will automatically reload when your connection is restored.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
