"use client";

import { Activity, RefreshCw } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";

interface LiveIndicatorProps {
  lastUpdated?: Date | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function LiveIndicator({
  lastUpdated,
  isRefreshing = false,
  onRefresh,
  className = "",
}: LiveIndicatorProps) {
  const [timeAgo, setTimeAgo] = React.useState("");

  React.useEffect(() => {
    if (!lastUpdated) return;

    const updateTimeAgo = () => {
      const now = new Date();
      const seconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);

      if (seconds < 10) {
        setTimeAgo("just now");
      } else if (seconds < 60) {
        setTimeAgo(`${seconds}s ago`);
      } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        setTimeAgo(`${minutes}m ago`);
      } else {
        const hours = Math.floor(seconds / 3600);
        setTimeAgo(`${hours}h ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);

    return () => clearInterval(interval);
  }, [lastUpdated]);

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      {/* Live indicator */}
      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-green-500/10 text-green-500 dark:bg-green-500/20">
        <Activity className="h-3 w-3 animate-pulse" />
        <span className="text-xs font-medium">Live</span>
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <span className="text-xs text-muted-foreground dark:text-muted-foreground">
          Updated {timeAgo}
        </span>
      )}

      {/* Manual refresh button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            "p-1 rounded hover:bg-accent dark:hover:bg-muted transition-colors",
            "text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-white",
            isRefreshing && "cursor-not-allowed opacity-50",
          )}
          aria-label="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </button>
      )}
    </div>
  );
}
