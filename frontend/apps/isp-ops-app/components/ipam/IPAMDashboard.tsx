"use client";

/**
 * IPAM Dashboard Component
 *
 * Overview dashboard for IP Address Management
 */

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { parseCIDR, IPFamily, getIPv4UsableHosts } from "@/lib/utils/ip-address";
import { Network, Globe, Server, TrendingUp } from "lucide-react";

export interface IPAMStats {
  totalPrefixes: number;
  ipv4Prefixes: number;
  ipv6Prefixes: number;
  totalAllocated: number;
  ipv4Allocated: number;
  ipv6Allocated: number;
  utilizationByPrefix?: PrefixUtilization[];
}

export interface PrefixUtilization {
  id: number;
  prefix: string;
  family: "ipv4" | "ipv6";
  totalIPs: number;
  allocatedIPs: number;
  utilizationPercent: number;
}

export interface IPAMDashboardProps {
  stats: IPAMStats;
}

export function IPAMDashboard({ stats }: IPAMDashboardProps) {
  const totalUtilization =
    stats.totalAllocated > 0
      ? ((stats.ipv4Allocated + stats.ipv6Allocated) / stats.totalAllocated) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Prefixes"
          value={stats.totalPrefixes}
          description="IPv4 and IPv6 prefixes"
          icon={<Network className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="IPv4 Prefixes"
          value={stats.ipv4Prefixes}
          description="IPv4 address blocks"
          icon={<Globe className="h-4 w-4 text-muted-foreground" />}
          badge={<Badge variant="default">IPv4</Badge>}
        />
        <SummaryCard
          title="IPv6 Prefixes"
          value={stats.ipv6Prefixes}
          description="IPv6 address blocks"
          icon={<Globe className="h-4 w-4 text-muted-foreground" />}
          badge={<Badge variant="secondary">IPv6</Badge>}
        />
        <SummaryCard
          title="Allocated IPs"
          value={stats.ipv4Allocated + stats.ipv6Allocated}
          description={`${stats.ipv4Allocated} IPv4, ${stats.ipv6Allocated} IPv6`}
          icon={<Server className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Utilization Overview */}
      {stats.utilizationByPrefix && stats.utilizationByPrefix.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prefix Utilization</CardTitle>
            <CardDescription>IP address allocation across prefixes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.utilizationByPrefix.map((prefix) => (
              <PrefixUtilizationRow key={prefix.id} utilization={prefix} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}

function SummaryCard({ title, value, description, icon, badge }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
          {badge}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

interface PrefixUtilizationRowProps {
  utilization: PrefixUtilization;
}

function PrefixUtilizationRow({ utilization }: PrefixUtilizationRowProps) {
  const getUtilizationColor = (percent: number) => {
    if (percent >= 90) return "text-red-600";
    if (percent >= 75) return "text-yellow-600";
    return "text-green-600";
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return "bg-red-600";
    if (percent >= 75) return "bg-yellow-600";
    return "bg-primary";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={utilization.family === "ipv4" ? "default" : "secondary"}>
            {utilization.family.toUpperCase()}
          </Badge>
          <span className="font-mono text-sm font-medium">{utilization.prefix}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {utilization.allocatedIPs.toLocaleString()} / {utilization.totalIPs.toLocaleString()}
          </span>
          <span
            className={`text-sm font-medium ${getUtilizationColor(utilization.utilizationPercent)}`}
          >
            {utilization.utilizationPercent.toFixed(1)}%
          </span>
        </div>
      </div>
      <Progress
        value={utilization.utilizationPercent}
        className="h-2"
        indicatorClassName={getProgressColor(utilization.utilizationPercent)}
      />
    </div>
  );
}
