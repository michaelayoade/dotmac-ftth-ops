"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Line,
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
import { Download, UserMinus, AlertCircle } from "lucide-react";
import { format, subMonths, eachMonthOfInterval } from "date-fns";

type TimeRange = "6m" | "12m" | "24m";

interface ChurnData {
  month: string;
  totalCustomers: number;
  churnedCustomers: number;
  churnRate: number;
  newCustomers: number;
  netGrowth: number;
}

export function ChurnAnalysisChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>("12m");

  // Generate sample data
  const data = useMemo<ChurnData[]>(() => {
    const now = new Date();
    const months = timeRange === "6m" ? 6 : timeRange === "12m" ? 12 : 24;
    const dates = eachMonthOfInterval({
      start: subMonths(now, months - 1),
      end: now,
    });

    return dates.map((date, i) => {
      const totalCustomers = 500 + i * 50;
      const churnedCustomers = 5 + Math.floor(Math.random() * 15);
      const newCustomers = 50 + Math.floor(Math.random() * 30);
      const churnRate = (churnedCustomers / totalCustomers) * 100;
      const netGrowth = newCustomers - churnedCustomers;

      return {
        month: format(date, "MMM yyyy"),
        totalCustomers,
        churnedCustomers,
        churnRate,
        newCustomers,
        netGrowth,
      };
    });
  }, [timeRange]);

  const latestData = data[data.length - 1];
  const avgChurnRate = data.reduce((sum, d) => sum + d.churnRate, 0) / data.length;
  const totalChurned = data.reduce((sum, d) => sum + d.churnedCustomers, 0);
  const netGrowthValue = latestData?.netGrowth ?? 0;

  const handleExport = () => {
    const csvContent = [
      [
        "Month",
        "Total Customers",
        "Churned Customers",
        "Churn Rate (%)",
        "New Customers",
        "Net Growth",
      ],
      ...data.map((d) => [
        d.month,
        d.totalCustomers,
        d.churnedCustomers,
        d.churnRate.toFixed(2),
        d.newCustomers,
        d.netGrowth,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `churn-analysis-${timeRange}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5" />
              Customer Churn Analysis
            </CardTitle>
            <CardDescription>Track customer retention and churn patterns</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6m">Last 6 months</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
                <SelectItem value="24m">Last 24 months</SelectItem>
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
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Current Churn Rate</p>
            <p className="text-2xl font-bold text-red-500">
              {latestData ? latestData.churnRate.toFixed(2) : "0.00"}%
            </p>
            <p className="text-xs text-muted-foreground">
              {latestData?.churnedCustomers ?? 0} customers
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Avg Churn Rate</p>
            <p className="text-2xl font-bold">{avgChurnRate.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground">
              Over {timeRange === "6m" ? "6" : timeRange === "12m" ? "12" : "24"} months
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Churned</p>
            <p className="text-2xl font-bold text-red-500">{totalChurned}</p>
            <p className="text-xs text-muted-foreground">Since {data[0]?.month}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Net Growth</p>
            <p
              className={`text-2xl font-bold ${
                netGrowthValue >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {netGrowthValue >= 0 ? "+" : ""}
              {netGrowthValue.toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground">Current month</p>
          </div>
        </div>

        {/* Alert for high churn */}
        {latestData && latestData.churnRate > 5 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-semibold text-red-500">High Churn Alert</p>
              <p className="text-sm text-muted-foreground">
                Current churn rate ({latestData.churnRate.toFixed(2)}%) is above the healthy
                threshold of 5%. Consider implementing retention strategies.
              </p>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis yAxisId="left" className="text-xs" />
              <YAxis yAxisId="right" orientation="right" className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="churnedCustomers"
                fill="hsl(0, 84%, 60%)"
                name="Churned Customers"
              />
              <Bar
                yAxisId="left"
                dataKey="newCustomers"
                fill="hsl(142, 76%, 36%)"
                name="New Customers"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="churnRate"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                name="Churn Rate (%)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Insights */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-2">Top Churn Reasons</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Service Quality Issues</span>
                <span className="font-medium">32%</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Pricing Concerns</span>
                <span className="font-medium">28%</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Moved/Relocation</span>
                <span className="font-medium">21%</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Competitor Offers</span>
                <span className="font-medium">19%</span>
              </li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-2">Retention Recommendations</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-green-500">•</span>
                Implement proactive support for service issues
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">•</span>
                Offer loyalty discounts to long-term customers
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">•</span>
                Create win-back campaigns for churned customers
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">•</span>
                Monitor competitor pricing and adjust offers
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
