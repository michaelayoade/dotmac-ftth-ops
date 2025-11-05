"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";

interface UsageMetric {
  name: string;
  current: number;
  limit: number | null;
  unit: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down";
    period: string;
  };
}

interface UsageAnalyticsDashboardProps {
  metrics: UsageMetric[];
  billingPeriodStart: string;
  billingPeriodEnd: string;
}

export const UsageAnalyticsDashboard: React.FC<UsageAnalyticsDashboardProps> = ({
  metrics,
  billingPeriodStart,
  billingPeriodEnd,
}) => {
  const calculateUsagePercentage = (current: number, limit: number | null): number => {
    if (!limit || limit === 0) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageStatus = (percentage: number): "safe" | "warning" | "critical" => {
    if (percentage >= 90) return "critical";
    if (percentage >= 75) return "warning";
    return "safe";
  };

  const formatNumber = (num: number, unit: string): string => {
    if (unit === "GB") {
      return (num / 1024 ** 3).toFixed(2);
    }
    return num.toLocaleString();
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Usage Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Billing period: {formatDate(billingPeriodStart)} - {formatDate(billingPeriodEnd)}
          </p>
        </div>
      </div>

      {/* Usage Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric) => {
          const percentage = calculateUsagePercentage(metric.current, metric.limit);
          const status = getUsageStatus(percentage);

          return (
            <Card key={metric.name} className={status === "critical" ? "border-red-500" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      {metric.icon}
                    </div>
                    <CardTitle className="text-base">{metric.name}</CardTitle>
                  </div>
                  {status === "critical" && (
                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Critical
                    </Badge>
                  )}
                  {status === "warning" && (
                    <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Warning
                    </Badge>
                  )}
                  {status === "safe" && (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Healthy
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Current Usage */}
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {formatNumber(metric.current, metric.unit)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {metric.limit
                        ? `of ${formatNumber(metric.limit, metric.unit)} ${metric.unit}`
                        : metric.unit}
                    </span>
                  </div>

                  {/* Trend Indicator */}
                  {metric.trend && (
                    <div className="flex items-center gap-1 mt-2">
                      {metric.trend.direction === "up" ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      <span
                        className={`text-sm ${
                          metric.trend.direction === "up" ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {metric.trend.value}% vs {metric.trend.period}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                {metric.limit && (
                  <div className="space-y-2">
                    <Progress
                      value={percentage}
                      className={
                        status === "critical"
                          ? "[&>div]:bg-red-500"
                          : status === "warning"
                            ? "[&>div]:bg-yellow-500"
                            : ""
                      }
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{percentage.toFixed(1)}% used</span>
                      <span>
                        {formatNumber(metric.limit - metric.current, metric.unit)} {metric.unit}{" "}
                        remaining
                      </span>
                    </div>
                  </div>
                )}

                {/* Unlimited indicator */}
                {!metric.limit && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Info className="w-4 h-4" />
                    <span>Unlimited</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Usage Alerts */}
      {metrics.some(
        (m) => getUsageStatus(calculateUsagePercentage(m.current, m.limit)) === "critical",
      ) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Usage limit reached:</strong> You&apos;ve exceeded 90% of your plan limits for
            one or more resources. Consider upgrading your plan to avoid service interruptions.
          </AlertDescription>
        </Alert>
      )}

      {metrics.some(
        (m) =>
          getUsageStatus(calculateUsagePercentage(m.current, m.limit)) === "warning" &&
          getUsageStatus(calculateUsagePercentage(m.current, m.limit)) !== "critical",
      ) && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Approaching limit:</strong> You&apos;re using more than 75% of your plan limits.
            You may want to upgrade soon to ensure uninterrupted service.
          </AlertDescription>
        </Alert>
      )}

      {/* Usage Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Optimization Tips</CardTitle>
          <CardDescription>Ways to manage your resource usage efficiently</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong>Users:</strong> Deactivate inactive users to free up seats
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong>Storage:</strong> Archive old files or enable compression
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong>API Calls:</strong> Implement caching to reduce API usage
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong>Need more?</strong> Upgrade your plan or purchase add-ons for additional
                resources
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Example usage with sample data
 */
export const UsageAnalyticsDashboardExample: React.FC = () => {
  const sampleMetrics: UsageMetric[] = [
    {
      name: "Active Users",
      current: 42,
      limit: 50,
      unit: "users",
      icon: <Users className="w-5 h-5 text-primary" />,
      trend: {
        value: 12,
        direction: "up",
        period: "last month",
      },
    },
    {
      name: "Storage Used",
      current: 85 * 1024 ** 3, // 85 GB in bytes
      limit: 100 * 1024 ** 3, // 100 GB
      unit: "GB",
      icon: <Database className="w-5 h-5 text-primary" />,
      trend: {
        value: 8,
        direction: "up",
        period: "last month",
      },
    },
    {
      name: "API Calls",
      current: 875000,
      limit: 1000000,
      unit: "calls",
      icon: <Zap className="w-5 h-5 text-primary" />,
      trend: {
        value: 5,
        direction: "down",
        period: "last month",
      },
    },
  ];

  return (
    <UsageAnalyticsDashboard
      metrics={sampleMetrics}
      billingPeriodStart="2025-10-01"
      billingPeriodEnd="2025-10-31"
    />
  );
};
