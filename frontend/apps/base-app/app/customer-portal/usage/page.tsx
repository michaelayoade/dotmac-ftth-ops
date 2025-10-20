"use client";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertCircle,
  Wifi,
  Loader2,
} from "lucide-react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { useCustomerUsage } from "@/hooks/useCustomerPortal";

export default function CustomerUsagePage() {
  const [timeRange, setTimeRange] = useState("7d");
  const { usage, loading } = useCustomerUsage();

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
          (new Date(usage.period_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        ),
      }
    : {
        upload_gb: 0,
        download_gb: 0,
        total_gb: 0,
        limit_gb: 1000,
        days_remaining: 0,
      };

  const usagePercentage = currentMonth.limit_gb > 0
    ? (currentMonth.total_gb / currentMonth.limit_gb) * 100
    : 0;

  // Generate daily usage data
  const dailyUsage = eachDayOfInterval({
    start: subDays(new Date(), timeRange === "7d" ? 6 : timeRange === "30d" ? 29 : 89),
    end: new Date(),
  }).map((date) => ({
    date: format(date, "MMM dd"),
    download: 5 + Math.random() * 10,
    upload: 1 + Math.random() * 3,
  }));

  const hourlyUsage = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, "0")}:00`,
    download: Math.random() * 5,
    upload: Math.random() * 2,
  }));

  const handleDownloadReport = async () => {
    try {
      // Prepare report data
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

      // Call API to generate PDF report
      const response = await fetch('/api/customer/usage/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate report: ${response.statusText}`);
      }

      // Get the PDF blob
      const blob = await response.blob();

      // Generate filename with current date
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const filename = `usage-report-${dateStr}.pdf`;

      // Create a download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log(`Usage report downloaded: ${filename}`);
    } catch (error) {
      console.error('Error downloading usage report:', error);
      alert(`Failed to download report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usage & Bandwidth</h1>
          <p className="text-muted-foreground">
            Monitor your internet usage
          </p>
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
            <div className="text-2xl font-bold">
              {currentMonth.total_gb.toFixed(1)} GB
            </div>
            <p className="text-xs text-muted-foreground">
              {usagePercentage.toFixed(1)}% of limit
            </p>
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
            <p className="text-xs text-muted-foreground">
              This billing period
            </p>
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
            <p className="text-xs text-muted-foreground">
              This billing period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Days Remaining</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMonth.days_remaining}
            </div>
            <p className="text-xs text-muted-foreground">
              Until next billing cycle
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Cap Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Data Cap Usage
          </CardTitle>
          <CardDescription>
            Your usage against the monthly data cap
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {currentMonth.total_gb.toFixed(1)} GB used of {currentMonth.limit_gb} GB
              </span>
              <span className="text-muted-foreground">
                {usagePercentage.toFixed(1)}%
              </span>
            </div>
            <Progress value={usagePercentage} className="h-3" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Used</p>
              <p className="text-2xl font-bold">
                {currentMonth.total_gb.toFixed(1)} GB
              </p>
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
                  You&apos;ve used {usagePercentage.toFixed(0)}% of your monthly data cap.
                  Consider upgrading your plan if you frequently exceed your limit.
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
              <CardDescription>
                Daily bandwidth usage
              </CardDescription>
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fontSize: 10 }}
                />
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
                <Bar
                  dataKey="upload"
                  stackId="a"
                  fill="hsl(142, 76%, 36%)"
                  name="Upload (GB)"
                />
              </BarChart>
            </ResponsiveContainer>
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
          <CardDescription>
            Bandwidth usage by hour (last 24 hours)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyUsage}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="hour"
                  className="text-xs"
                  tick={{ fontSize: 10 }}
                />
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
              <span>Consider upgrading to an unlimited plan if you consistently exceed your cap</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
