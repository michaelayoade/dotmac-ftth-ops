"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, RefreshCw, TrendingUp, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";

interface AgentPerformanceMetrics {
  agent_id: string;
  agent_name: string | null;
  agent_email: string | null;
  total_assigned: number;
  total_resolved: number;
  total_open: number;
  total_in_progress: number;
  avg_resolution_time_minutes: number | null;
  avg_first_response_time_minutes: number | null;
  sla_compliance_rate: number | null;
  escalation_rate: number | null;
}

export default function AgentPerformancePage() {
  const [timeRange, setTimeRange] = useState<string>("30d");

  // Calculate date range based on selection
  const getDateRange = () => {
    const end = new Date();
    const start = new Date();

    switch (timeRange) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "7d":
        start.setDate(start.getDate() - 7);
        break;
      case "30d":
        start.setDate(start.getDate() - 30);
        break;
      case "90d":
        start.setDate(start.getDate() - 90);
        break;
      case "all":
        return { start_date: undefined, end_date: undefined };
    }

    return {
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    };
  };

  const dateRange = getDateRange();

  // Fetch agent performance metrics
  const {
    data: metrics,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["agent-performance", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.start_date) params.append("start_date", dateRange.start_date);
      if (dateRange.end_date) params.append("end_date", dateRange.end_date);

      const response = await apiClient.get(`/tickets/agents/performance?${params}`);
      return response.data as AgentPerformanceMetrics[];
    },
    refetchInterval: 30000,
  });

  // Calculate summary statistics
  const summary = metrics
    ? {
        totalAgents: metrics.length,
        totalAssigned: metrics.reduce((sum, m) => sum + m.total_assigned, 0),
        totalResolved: metrics.reduce((sum, m) => sum + m.total_resolved, 0),
        avgSLACompliance: metrics.length
          ? metrics.reduce((sum, m) => sum + (m.sla_compliance_rate || 0), 0) / metrics.length
          : 0,
      }
    : { totalAgents: 0, totalAssigned: 0, totalResolved: 0, avgSLACompliance: 0 };

  const formatMinutes = (minutes: number | null) => {
    if (!minutes) return "N/A";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatPercentage = (value: number | null) => {
    if (value === null) return "N/A";
    return `${value.toFixed(1)}%`;
  };

  const getSLABadge = (rate: number | null) => {
    if (rate === null) return <Badge variant="outline">N/A</Badge>;
    if (rate >= 90) return <Badge variant="default">{rate.toFixed(1)}%</Badge>;
    if (rate >= 75) return <Badge variant="secondary">{rate.toFixed(1)}%</Badge>;
    return <Badge variant="destructive">{rate.toFixed(1)}%</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agent Performance Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Track support agent performance metrics and workload distribution
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading || isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalAgents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <Users className="inline h-3 w-3 mr-1" />
              With assigned tickets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Assigned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalAssigned}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              Across all agents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.totalResolved}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <CheckCircle2 className="inline h-3 w-3 mr-1" />
              {summary.totalAssigned > 0
                ? `${((summary.totalResolved / summary.totalAssigned) * 100).toFixed(1)}% resolution`
                : "No data"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg SLA Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgSLACompliance.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              <Clock className="inline h-3 w-3 mr-1" />
              Team average
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : metrics && metrics.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Resolved</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead>In Progress</TableHead>
                  <TableHead>Avg Resolution Time</TableHead>
                  <TableHead>Avg Response Time</TableHead>
                  <TableHead>SLA Compliance</TableHead>
                  <TableHead>Escalation Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics
                  .sort((a, b) => b.total_assigned - a.total_assigned)
                  .map((agent) => (
                    <TableRow key={agent.agent_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{agent.agent_name || "Unknown Agent"}</div>
                          <div className="text-sm text-muted-foreground">
                            {agent.agent_email || "No email"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{agent.total_assigned}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-green-600">{agent.total_resolved}</span>
                          <span className="text-xs text-muted-foreground">
                            (
                            {agent.total_assigned > 0
                              ? ((agent.total_resolved / agent.total_assigned) * 100).toFixed(0)
                              : 0}
                            %)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{agent.total_open}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{agent.total_in_progress}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatMinutes(agent.avg_resolution_time_minutes)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatMinutes(agent.avg_first_response_time_minutes)}
                      </TableCell>
                      <TableCell>{getSLABadge(agent.sla_compliance_rate)}</TableCell>
                      <TableCell>
                        {agent.escalation_rate !== null && agent.escalation_rate > 20 ? (
                          <div className="flex items-center gap-1 text-orange-600">
                            <AlertCircle className="h-4 w-4" />
                            {formatPercentage(agent.escalation_rate)}
                          </div>
                        ) : (
                          formatPercentage(agent.escalation_rate)
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No agent data available</h3>
              <p className="text-sm text-muted-foreground">
                No tickets have been assigned to agents in the selected time range
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
