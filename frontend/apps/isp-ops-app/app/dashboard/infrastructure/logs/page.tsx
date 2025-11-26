"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { ScrollArea } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import {
  Search,
  Download,
  RefreshCw,
  Terminal,
  AlertCircle,
  Info,
  AlertTriangle,
  XCircle,
  Copy,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { useLogs } from "@/hooks/useLogs";
import type { LogsFilter } from "@/hooks/useLogs";

export default function LogsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const buildFilters = useCallback(() => {
    const nextFilters: LogsFilter = {
      page: 1,
      page_size: 100,
    };
    if (levelFilter !== "all") {
      nextFilters.level = levelFilter;
    }
    if (serviceFilter !== "all") {
      nextFilters.service = serviceFilter;
    }
    const trimmedSearch = searchTerm.trim();
    if (trimmedSearch.length > 0) {
      nextFilters.search = trimmedSearch;
    }
    return nextFilters;
  }, [levelFilter, searchTerm, serviceFilter]);
  const [filters, setFilters] = useState<LogsFilter>(() => buildFilters());

  // Use the real API hook
  const { logs, stats, services, isLoading, error, pagination, refetch } = useLogs(filters);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Refetch when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(buildFilters());
    }, 500);

    return () => clearTimeout(timer);
  }, [buildFilters]);

  const handleExport = () => {
    const exportData = JSON.stringify(logs, null, 2);
    const blob = new Blob([exportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.json`;
    document["body"].appendChild(a);
    a.click();
    document["body"].removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Logs exported successfully" });
  };

  const handleCopyLog = (log: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    toast({ title: "Success", description: "Log entry copied to clipboard" });
  };

  const handleRefresh = () => {
    refetch();
    toast({ title: "Success", description: "Logs refreshed" });
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "INFO":
        return <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "DEBUG":
        return <Terminal className="h-4 w-4 text-muted-foreground" />;
      case "WARNING":
        return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      case "ERROR":
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case "CRITICAL":
        return <AlertCircle className="h-4 w-4 text-red-700 dark:text-red-300" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getLevelBadgeVariant = (level: string) => {
    switch (level) {
      case "INFO":
        return "outline" as const;
      case "DEBUG":
        return "secondary" as const;
      case "WARNING":
        return "secondary" as const;
      case "ERROR":
        return "destructive" as const;
      case "CRITICAL":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  // Log statistics from API
  const logStats = stats
    ? {
        total: stats["by_level"] ? Object.values(stats["by_level"]).reduce((a, b) => a + b, 0) : 0,
        info: stats["by_level"]?.["INFO"] || 0,
        debug: stats["by_level"]?.["DEBUG"] || 0,
        warning: stats["by_level"]?.["WARNING"] || 0,
        error: stats["by_level"]?.["ERROR"] || 0,
        critical: stats["by_level"]?.["CRITICAL"] || 0,
      }
    : {
        total: logs.length,
        info: 0,
        debug: 0,
        warning: 0,
        error: 0,
        critical: 0,
      };

  return (
    <div className={`space-y-6 ${isFullscreen ? "fixed inset-0 z-50 bg-background p-6" : ""}`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">System Logs</h1>
          <p className="text-muted-foreground mt-2">
            View and analyze application logs in real-time
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={logs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="default" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{logStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-blue-600 dark:text-blue-400">Info</div>
            <div className="text-2xl font-bold">{logStats.info}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Debug</div>
            <div className="text-2xl font-bold">{logStats.debug}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Warning</div>
            <div className="text-2xl font-bold">{logStats.warning}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-red-600 dark:text-red-400">Error</div>
            <div className="text-2xl font-bold">{logStats.error}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-red-700 dark:text-red-300">Critical</div>
            <div className="text-2xl font-bold">{logStats.critical}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="h-10 w-[150px] rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="all">All Levels</option>
              <option value="INFO">Info</option>
              <option value="DEBUG">Debug</option>
              <option value="WARNING">Warning</option>
              <option value="ERROR">Error</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="h-10 w-[150px] rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="all">All Services</option>
              {services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
            <div className="flex items-center space-x-2">
              <Switch id="auto-scroll" checked={autoScroll} onCheckedChange={setAutoScroll} />
              <Label htmlFor="auto-scroll">Auto-scroll</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Viewer */}
      <Card className={isFullscreen ? "h-full" : ""}>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Log Stream</CardTitle>
            {pagination["has_more"] && (
              <Badge variant="outline">
                Showing {logs.length} of {pagination["total"]}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center h-[600px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading logs...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[600px] text-red-600 dark:text-red-400">
              <AlertCircle className="h-8 w-8 mr-2" />
              <span>{error}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-[600px] text-muted-foreground">
              <Info className="h-8 w-8 mr-2" />
              <span>No logs found</span>
            </div>
          ) : (
            <ScrollArea
              ref={scrollRef}
              className={`${isFullscreen ? "h-[calc(100vh-400px)]" : "h-[600px]"} font-mono text-sm`}
            >
              <div className="space-y-1">
                {logs.map((log) => (
                  <div
                    key={log["id"]}
                    className="group flex items-start gap-2 p-2 hover:bg-muted rounded"
                  >
                    <div className="flex-shrink-0 mt-0.5">{getLevelIcon(log["level"])}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {new Date(log["timestamp"]).toLocaleTimeString()}
                        </span>
                        <Badge variant={getLevelBadgeVariant(log["level"])} className="text-xs">
                          {log["level"]}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {log["service"]}
                        </Badge>
                        {log["metadata"]["request_id"] && (
                          <span className="text-xs text-muted-foreground">
                            {log["metadata"]["request_id"]}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 break-all">
                        <span className="text-foreground">{log["message"]}</span>
                      </div>
                      {(log["metadata"]["user_id"] || log["metadata"]["duration"]) && (
                        <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                          {log["metadata"]["user_id"] && (
                            <span>User: {log["metadata"]["user_id"]}</span>
                          )}
                          {log["metadata"]["duration"] && (
                            <span>Duration: {log["metadata"]["duration"]}ms</span>
                          )}
                          {log["metadata"]["ip"] && <span>IP: {log["metadata"]["ip"]}</span>}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleCopyLog(log)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
