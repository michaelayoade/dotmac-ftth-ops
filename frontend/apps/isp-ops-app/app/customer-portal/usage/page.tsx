"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  Download,
  Upload,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Wifi,
  Loader2,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { useCustomerUsage } from "@/hooks/useCustomerPortal";
import { useToast } from "@dotmac/ui";
import { useApiConfig } from "@/hooks/useApiConfig";
import {
  CUSTOMER_PORTAL_TOKEN_KEY,
  getPortalAuthToken,
  setPortalAuthToken,
} from "../../../../../shared/utils/operatorAuth";

export default function CustomerUsagePage() {
  const [timeRange, setTimeRange] = useState("7d");
  const { usage, loading } = useCustomerUsage();
  const { toast } = useToast();
  const { apiBaseUrl } = useApiConfig();
  const [usageHistory, setUsageHistory] = useState<{
    dailyUsage: Array<{ date: string; download: number; upload: number }>;
    hourlyUsage: Array<{ hour: string; download: number; upload: number }>;
    highestUsageDayGb?: number;
    highestUsageDate?: string;
    usageTrendPercent?: number;
    overageGb?: number;
  } | null>(null);

  useEffect(() => {
    const fetchUsageHistory = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");
        const storedToken = getPortalAuthToken({
          tokenKey: CUSTOMER_PORTAL_TOKEN_KEY,
          required: false,
        });
        const token = urlToken || storedToken;
        if (!token || loading) {
          return;
        }

        const response = await fetch(
          `${apiBaseUrl}/api/isp/v1/portal/customer/usage/history?time_range=${timeRange}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (urlToken) {
          setPortalAuthToken(urlToken, CUSTOMER_PORTAL_TOKEN_KEY);
        }

        if (!response.ok) return;

        const data = await response.json();
        setUsageHistory({
          dailyUsage: data.daily_usage || [],
          hourlyUsage: data.hourly_usage || [],
          highestUsageDayGb: data.highest_usage_day_gb,
          highestUsageDate: data.highest_usage_date,
          usageTrendPercent: data.usage_trend_percent,
          overageGb: data.overage_gb,
        });
      } catch (error) {
        console.error("Error fetching usage history:", error);
      }
    };

    fetchUsageHistory();
  }, [apiBaseUrl, timeRange, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading usage data...</p>
        </div>
      </div>
    );
  }

  const currentMonth = usage
    ? {
        upload_gb: usage.upload_gb,
        download_gb: usage.download_gb,
        total_gb: usage.total_gb,
        limit_gb: usage.limit_gb,
        days_remaining: Math.ceil(
          (new Date(usage.period_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
        ),
      }
    : {
        upload_gb: 0,
        download_gb: 0,
        total_gb: 0,
        limit_gb: 1000,
        days_remaining: 0,
      };

  const usagePercentage =
    currentMonth.limit_gb > 0 ? (currentMonth.total_gb / currentMonth.limit_gb) * 100 : 0;

  const dailyUsage = usageHistory?.dailyUsage || [];
  const hourlyUsage = usageHistory?.hourlyUsage || [];
  const usageHistoryAvailable = dailyUsage.length > 0 || hourlyUsage.length > 0;

  const handleDownloadReport = async () => {
    try {
      const reportData = {
        period: {
          start: usage?.period_start,
          end: usage?.period_end,
        },
        summary: {
          total_gb: currentMonth.total_gb,
          download_gb: currentMonth.download_gb,
          upload_gb: currentMonth.upload_gb,
          limit_gb: currentMonth.limit_gb,
          usage_percentage: usagePercentage,
          days_remaining: currentMonth.days_remaining,
        },
        daily_usage: dailyUsage,
        hourly_usage: hourlyUsage,
        time_range: timeRange,
      };

      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("token");
      const storedToken = getPortalAuthToken({
        tokenKey: CUSTOMER_PORTAL_TOKEN_KEY,
        required: false,
      });
      const token = urlToken || storedToken;
      if (!token) {
        throw new Error("Customer session expired");
      }
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/portal/customer/usage/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reportData),
      });

      if (urlToken) {
        setPortalAuthToken(urlToken, CUSTOMER_PORTAL_TOKEN_KEY);
      }

      if (!response.ok) {
        throw new Error(`Failed to generate report: ${response.statusText}`);
      }

      const blob = await response.blob();
      const dateStr = format(new Date(), "yyyy-MM-dd");
      const filename = `usage-report-${dateStr}.pdf`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Report Downloaded",
        description: "Your usage report has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Error downloading usage report:", error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download usage report",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usage & Bandwidth</h1>
          <p className="text-muted-foreground">Monitor your internet usage</p>
        </div>
        <Button variant="outline" onClick={handleDownloadReport}>
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
      </div>

      {/* Usage Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonth.total_gb.toFixed(1)} GB</div>
            <p className="text-xs text-muted-foreground">{usagePercentage.toFixed(1)}% of limit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Downloaded</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {currentMonth.download_gb.toFixed(1)} GB
            </div>
            <p className="text-xs text-muted-foreground">This billing period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uploaded</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {currentMonth.upload_gb.toFixed(1)} GB
            </div>
            <p className="text-xs text-muted-foreground">This billing period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Days Remaining</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonth.days_remaining}</div>
            <p className="text-xs text-muted-foreground">Until next billing cycle</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Insights */}
      {(usageHistory?.highestUsageDayGb || usageHistory?.usageTrendPercent !== undefined) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Usage Insights
            </CardTitle>
            <CardDescription>Trends and patterns in your data usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {usageHistory?.highestUsageDayGb && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Highest Usage Day</p>
                  <p className="text-2xl font-bold text-blue-500">
                    {usageHistory.highestUsageDayGb.toFixed(1)} GB
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {usageHistory.highestUsageDate
                      ? format(new Date(usageHistory.highestUsageDate), "MMM dd, yyyy")
                      : "N/A"}
                  </p>
                </div>
              )}
              {usageHistory?.usageTrendPercent !== undefined && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Usage Trend (7 days)</p>
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-2xl font-bold ${
                        usageHistory.usageTrendPercent > 0 ? "text-red-500" : "text-green-500"
                      }`}
                    >
                      {usageHistory.usageTrendPercent > 0 ? "+" : ""}
                      {usageHistory.usageTrendPercent.toFixed(1)}%
                    </p>
                    {usageHistory.usageTrendPercent > 0 ? (
                      <TrendingUp className="h-5 w-5 text-red-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {usageHistory.usageTrendPercent > 0 ? "Increasing" : "Decreasing"} compared to
                    prior week
                  </p>
                </div>
              )}
              {usageHistory?.overageGb !== undefined && usageHistory.overageGb > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Overage</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {usageHistory.overageGb.toFixed(1)} GB
                  </p>
                  <p className="text-xs text-muted-foreground">Exceeds plan limit</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Cap Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Data Cap Usage
          </CardTitle>
          <CardDescription>Your usage against the monthly data cap</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {currentMonth.total_gb.toFixed(1)} GB used of {currentMonth.limit_gb} GB
              </span>
              <span className="text-muted-foreground">{usagePercentage.toFixed(1)}%</span>
            </div>
            <Progress value={usagePercentage} className="h-3" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Used</p>
              <p className="text-2xl font-bold">{currentMonth.total_gb.toFixed(1)} GB</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className="text-2xl font-bold text-green-500">
                {(currentMonth.limit_gb - currentMonth.total_gb).toFixed(1)} GB
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Daily Average</p>
              <p className="text-2xl font-bold">
                {(currentMonth.total_gb / (30 - currentMonth.days_remaining)).toFixed(1)} GB
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Projected</p>
              <p className="text-2xl font-bold text-blue-500">
                {((currentMonth.total_gb / (30 - currentMonth.days_remaining)) * 30).toFixed(1)} GB
              </p>
            </div>
          </div>

          {usagePercentage > 80 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-500">Usage Alert</p>
                <p className="text-sm text-muted-foreground">
                  You&apos;ve used {usagePercentage.toFixed(0)}% of your monthly data cap. Consider
                  upgrading your plan if you frequently exceed your limit.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Charts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Usage History
              </CardTitle>
              <CardDescription>Daily bandwidth usage</CardDescription>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            {usageHistoryAvailable ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="download"
                    stackId="a"
                    fill="hsl(217, 91%, 60%)"
                    name="Download (GB)"
                  />
                  <Bar dataKey="upload" stackId="a" fill="hsl(142, 76%, 36%)" name="Upload (GB)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <BarChart3 className="h-16 w-16 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Usage History Coming Soon</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Detailed usage history charts will be available once we implement the telemetry
                  API endpoint.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hourly Usage Pattern */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Today&apos;s Usage Pattern
          </CardTitle>
          <CardDescription>Bandwidth usage by hour (last 24 hours)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {usageHistoryAvailable ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyUsage}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="download"
                    stroke="hsl(217, 91%, 60%)"
                    strokeWidth={2}
                    dot={false}
                    name="Download (Mbps)"
                  />
                  <Line
                    type="monotone"
                    dataKey="upload"
                    stroke="hsl(142, 76%, 36%)"
                    strokeWidth={2}
                    dot={false}
                    name="Upload (Mbps)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Wifi className="h-16 w-16 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Hourly Pattern Coming Soon</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Hourly usage patterns will be available once we implement the telemetry API
                  endpoint.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Tips to Manage Your Data Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Stream videos in standard definition instead of HD to save data</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Download large files during off-peak hours</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Enable auto-updates only when connected to WiFi</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>
                Consider upgrading to an unlimited plan if you consistently exceed your cap
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
