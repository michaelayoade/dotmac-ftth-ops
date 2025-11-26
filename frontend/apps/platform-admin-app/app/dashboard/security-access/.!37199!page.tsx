"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  Key,
  Lock,
  Users,
  UserCheck,
  AlertTriangle,
  ArrowUpRight,
  Activity,
  Eye,
  FileWarning,
} from "lucide-react";
import { metricsService, SecurityMetrics } from "@/lib/services/metrics-service";
import { AlertBanner } from "@/components/alerts/AlertBanner";
import { apiClient } from "@/lib/api/client";

interface SecurityMetric {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  status?: "success" | "warning" | "danger";
  href?: string;
}

function SecurityMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  status = "success",
  href,
}: SecurityMetric) {
  const statusColors = {
    success: "text-green-400 bg-green-400/10",
    warning: "text-yellow-400 bg-yellow-400/10",
    danger: "text-red-400 bg-red-400/10",
  };

  const content = (
    <div className="rounded-lg border border-border bg-card p-6 hover:border-border transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${statusColors[status]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block group relative">
        {content}
        <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    );
  }

  return content;
}

interface SecurityEvent {
  id: string;
  type:
    | "auth_success"
    | "auth_failure"
    | "permission_change"
    | "api_key_created"
    | "secret_accessed";
  description: string;
  user?: string;
  timestamp: string;
  severity: "info" | "warning" | "critical";
}

function SecurityEventLog({ events }: { events: SecurityEvent[] }) {
  const severityColors = {
    info: "text-blue-600 dark:text-blue-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    critical: "text-red-600 dark:text-red-400",
  };

  const typeIcons = {
    auth_success: UserCheck,
    auth_failure: AlertTriangle,
    permission_change: Shield,
    api_key_created: Key,
    secret_accessed: Eye,
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Security Events</h3>
        <Link
          href="/dashboard/security-access/audit"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
