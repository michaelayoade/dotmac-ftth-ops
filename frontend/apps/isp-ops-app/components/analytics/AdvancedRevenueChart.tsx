"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Download, TrendingUp, DollarSign } from "lucide-react";
import {
  format,
  subDays,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachMonthOfInterval,
} from "date-fns";

type ChartType = "line" | "area" | "bar";
type TimeRange = "7d" | "30d" | "90d" | "12m";

interface RevenueData {
  date: string;
  mrr: number;
  newRevenue: number;
  churnRevenue: number;
  totalRevenue: number;
}

export function AdvancedRevenueChart() {
  const [chartType, setChartType] = useState<ChartType>("area");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  // Generate sample data based on time range
  const data = useMemo<RevenueData[]>(() => {
    const now = new Date();
    let dates: Date[] = [];

    if (timeRange === "7d") {
      dates = eachDayOfInterval({ start: subDays(now, 6), end: now });
    } else if (timeRange === "30d") {
      dates = eachDayOfInterval({ start: subDays(now, 29), end: now });
    } else if (timeRange === "90d") {
      dates = eachDayOfInterval({ start: subDays(now, 89), end: now });
    } else {
      // 12 months
      dates = eachMonthOfInterval({ start: subMonths(now, 11), end: now });
    }

    return dates.map((date, i) => {
      const baseMRR = 50000 + i * 1000;
      const variance = Math.random() * 5000;
      return {
        date: timeRange === "12m" ? format(date, "MMM yyyy") : format(date, "MMM dd"),
        mrr: baseMRR + variance,
        newRevenue: 2000 + Math.random() * 3000,
        churnRevenue: 500 + Math.random() * 1500,
        totalRevenue: baseMRR + variance + (2000 + Math.random() * 3000),
      };
    });
  }, [timeRange]);

  const latestData = data[data.length - 1];
  const previousData = data[data.length - 2];
  const mrrGrowth =
    latestData && previousData ? ((latestData.mrr - previousData.mrr) / previousData.mrr) * 100 : 0;

  const handleExport = () => {
    const csvContent = [
      ["Date", "MRR", "New Revenue", "Churn Revenue", "Total Revenue"],
      ...data.map((d) => [d.date, d.mrr, d.newRevenue, d.churnRevenue, d.totalRevenue]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-data-${timeRange}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    if (chartType === "line") {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" className="text-xs" />
          <YAxis className="text-xs" />
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
            dataKey="mrr"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            name="MRR"
          />
          <Line
            type="monotone"
            dataKey="newRevenue"
            stroke="hsl(142, 76%, 36%)"
            strokeWidth={2}
            name="New Revenue"
          />
          <Line
            type="monotone"
            dataKey="churnRevenue"
            stroke="hsl(0, 84%, 60%)"
            strokeWidth={2}
            name="Churn Revenue"
          />
        </LineChart>
      );
    }

    if (chartType === "area") {
      return (
        <AreaChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="mrr"
            stackId="1"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.6}
            name="MRR"
          />
          <Area
            type="monotone"
            dataKey="newRevenue"
            stackId="1"
            stroke="hsl(142, 76%, 36%)"
            fill="hsl(142, 76%, 36%)"
            fillOpacity={0.6}
            name="New Revenue"
          />
        </AreaChart>
      );
    }

    return (
      <BarChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" className="text-xs" />
        <YAxis className="text-xs" />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
        />
        <Legend />
        <Bar dataKey="mrr" fill="hsl(var(--primary))" name="MRR" />
        <Bar dataKey="newRevenue" fill="hsl(142, 76%, 36%)" name="New Revenue" />
        <Bar dataKey="churnRevenue" fill="hsl(0, 84%, 60%)" name="Churn Revenue" />
      </BarChart>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Revenue Analytics
            </CardTitle>
            <CardDescription>Track MRR, new revenue, and churn over time</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="area">Area</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Current MRR</p>
            <p className="text-2xl font-bold">
              $
              {latestData?.mrr.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </p>
            <p
              className={`text-xs flex items-center gap-1 ${
                mrrGrowth >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              <TrendingUp className="h-3 w-3" />
              {mrrGrowth >= 0 ? "+" : ""}
              {mrrGrowth.toFixed(2)}% vs previous period
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">New Revenue</p>
            <p className="text-2xl font-bold text-green-500">
              +$
              {latestData?.newRevenue.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </p>
            <p className="text-xs text-muted-foreground">Current period</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Churn Revenue</p>
            <p className="text-2xl font-bold text-red-500">
              -$
              {latestData?.churnRevenue.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </p>
            <p className="text-xs text-muted-foreground">Current period</p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
