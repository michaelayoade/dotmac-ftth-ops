"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { useActivitySummary } from "@/hooks/useAudit";
import {
  ActivitySeverity,
  SEVERITY_COLORS,
  formatActivityType,
  getActivityIcon,
} from "@/types/audit";
import Link from "next/link";

export function AuditSummaryDashboard() {
  const [timeRange, setTimeRange] = useState<number>(7);

  const {
    data: summary,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useActivitySummary(timeRange, true);

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
            <p>Failed to load audit summary</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Loading audit summary...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  const totalActivities = summary.total_activities;
  const criticalCount = summary.by_severity[ActivitySeverity.CRITICAL] || 0;
  const highCount = summary.by_severity[ActivitySeverity.HIGH] || 0;
  const mediumCount = summary.by_severity[ActivitySeverity.MEDIUM] || 0;
  const lowCount = summary.by_severity[ActivitySeverity.LOW] || 0;

  // Top activity types
  const topActivityTypes = Object.entries(summary.by_type)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Top users by activity count
  const topUsers = summary.by_user.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Audit Activity Summary
          </h2>
          <p className="text-muted-foreground mt-1">
            Overview of security and compliance activities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange.toString()} onValueChange={(v) => setTimeRange(parseInt(v))}>
            <SelectTrigger className="w-[180px]">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Activities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{totalActivities.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last {timeRange} {timeRange === 1 ? "day" : "days"}
                </p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        {/* Critical Activities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-red-600">{criticalCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Requires immediate attention</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        {/* High Priority */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              High Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-orange-600">{highCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Review recommended</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{topUsers.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Users with activity</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Activity Severity Distribution
            </CardTitle>
            <CardDescription>Breakdown of activities by severity level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Critical */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge className={SEVERITY_COLORS[ActivitySeverity.CRITICAL]}>CRITICAL</Badge>
                  <span className="font-semibold">{criticalCount}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${totalActivities > 0 ? (criticalCount / totalActivities) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* High */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge className={SEVERITY_COLORS[ActivitySeverity.HIGH]}>HIGH</Badge>
                  <span className="font-semibold">{highCount}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${totalActivities > 0 ? (highCount / totalActivities) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Medium */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge className={SEVERITY_COLORS[ActivitySeverity.MEDIUM]}>MEDIUM</Badge>
                  <span className="font-semibold">{mediumCount}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-yellow-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${totalActivities > 0 ? (mediumCount / totalActivities) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Low */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge className={SEVERITY_COLORS[ActivitySeverity.LOW]}>LOW</Badge>
                  <span className="font-semibold">{lowCount}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${totalActivities > 0 ? (lowCount / totalActivities) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Activity Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Top Activity Types
            </CardTitle>
            <CardDescription>Most frequent activity types in this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topActivityTypes.map(([type, count]) => {
                const percentage = totalActivities > 0 ? (count / totalActivities) * 100 : 0;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getActivityIcon(type)}</span>
                        <span className="text-sm font-medium">{formatActivityType(type)}</span>
                      </div>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout - Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Active Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Most Active Users
            </CardTitle>
            <CardDescription>Users with the highest activity count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topUsers.map((user, index) => (
                <Link
                  key={user.user_id}
                  href={`/dashboard/platform-admin/audit/user/${user.user_id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium font-mono text-sm">{user.user_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.count} {user.count === 1 ? "activity" : "activities"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">{user.count}</Badge>
                  </div>
                </Link>
              ))}
              {topUsers.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No user activity recorded</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Critical Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Recent Critical Activities
            </CardTitle>
            <CardDescription>Latest activities requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.recent_critical.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl mt-0.5">
                      {getActivityIcon(activity.activity_type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={SEVERITY_COLORS[activity.severity]}>
                          {activity.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-mono">
                          {formatActivityType(activity.activity_type)}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium mb-1">{activity.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(activity.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {summary.recent_critical.length === 0 && (
                <div className="text-center py-6">
                  <Shield className="h-12 w-12 mx-auto text-green-500 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No critical activities in this period
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All systems operating normally
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Activity Timeline
          </CardTitle>
          <CardDescription>Daily activity trends over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {summary.timeline.map((entry) => {
              const maxCount = Math.max(...summary.timeline.map((e) => e.count));
              const percentage = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
              const date = new Date(entry.date);

              return (
                <div key={entry.date} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-muted-foreground text-right">
                    {date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-6 relative">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-6 rounded-full transition-all flex items-center justify-end pr-2"
                        style={{ width: `${percentage}%` }}
                      >
                        {entry.count > 0 && (
                          <span className="text-xs font-semibold text-white">{entry.count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
