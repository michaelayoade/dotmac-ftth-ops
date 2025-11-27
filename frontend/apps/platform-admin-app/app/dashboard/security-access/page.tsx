"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Eye,
  Key,
  Lock,
  Shield,
  UserCheck,
  Users,
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
          View all →
        </Link>
      </div>
      <div className="divide-y divide-border max-h-96 overflow-y-auto">
        {events.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">No recent security events</div>
        ) : (
          events.map((event) => {
            const Icon = typeIcons[event.type];
            return (
              <div key={event.id} className="p-4 hover:bg-muted transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Icon className={`h-4 w-4 ${severityColors[event.severity]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{event.description}</p>
                    {event.user && (
                      <p className="text-sm text-muted-foreground mt-1">User: {event.user}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {event.timestamp}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

interface AccessControlSummary {
  totalUsers: number;
  activeUsers: number;
  totalRoles: number;
  apiKeys: number;
  secrets: number;
  mfaEnabled: number;
}

function AccessControlPanel({ data }: { data: AccessControlSummary }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Access Control Summary</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Total Users</span>
          </div>
          <span className="font-medium text-foreground">{data.totalUsers}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Active Users</span>
          </div>
          <span className="font-medium text-foreground">{data.activeUsers}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Roles Configured</span>
          </div>
          <span className="font-medium text-foreground">{data.totalRoles}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">API Keys</span>
          </div>
          <span className="font-medium text-foreground">{data.apiKeys}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Secrets Stored</span>
          </div>
          <span className="font-medium text-foreground">{data.secrets}</span>
        </div>
        <div className="border-t border-border pt-4 mt-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">MFA Adoption</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 dark:bg-green-500 rounded-full"
                  style={{
                    width: `${(data.mfaEnabled / data.totalUsers) * 100}%`,
                  }}
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {Math.round((data.mfaEnabled / data.totalUsers) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SecurityAccessPage() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [accessControlData, setAccessControlData] = useState<AccessControlSummary | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);

  useEffect(() => {
    fetchSecurityData();
    // Refresh metrics every 60 seconds
    const interval = setInterval(fetchSecurityData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchSecurityData = async () => {
    try {
      // Fetch security metrics from the metrics service
      const securityMetrics = await metricsService.getSecurityMetrics();
      setMetrics(securityMetrics);

      // Calculate access control summary from metrics
      const totalUsers = securityMetrics.auth.activeSessions || 0;
      setAccessControlData({
        totalUsers,
        activeUsers: securityMetrics.auth.activeSessions || 0,
        totalRoles: 12, // This would come from a roles API
        apiKeys: securityMetrics.apiKeys.total || 0,
        secrets: securityMetrics.secrets.total || 0,
        mfaEnabled: securityMetrics.auth.mfaEnabled || 0,
      });

      // Fetch recent audit events
      try {
        const eventsResponse = await apiClient.get<Array<Record<string, unknown>>>(
          "/audit/activities/recent?limit=10",
        );
        if (eventsResponse.data) {
          const events: SecurityEvent[] = eventsResponse.data.map((e, index: number) => {
            const eventType = e["type"] as string;
            const validTypes: SecurityEvent["type"][] = [
              "auth_success",
              "auth_failure",
              "permission_change",
              "api_key_created",
              "secret_accessed",
            ];
            const type: SecurityEvent["type"] = validTypes.includes(
              eventType as SecurityEvent["type"],
            )
              ? (eventType as SecurityEvent["type"])
              : "auth_success";

            const eventSeverity = e["severity"] as string;
            const validSeverities: SecurityEvent["severity"][] = ["info", "warning", "critical"];
            const severity: SecurityEvent["severity"] = validSeverities.includes(
              eventSeverity as SecurityEvent["severity"],
            )
              ? (eventSeverity as SecurityEvent["severity"])
              : "info";

            return {
              id: (e["id"] as string) || `event-${index}`,
              type,
              description:
                (e["description"] as string) || (e["message"] as string) || "Security event",
              user: (e["user_email"] as string) || (e["user_id"] as string),
              timestamp: e["created_at"]
                ? new Date(e["created_at"] as string).toLocaleString()
                : "Recently",
              severity,
            };
          });
          setRecentEvents(events);
        }
      } catch {
        // Fallback to showing metrics-based events
        const fallbackEvents: SecurityEvent[] = [];

        if (securityMetrics.auth.failedAttempts > 0) {
          fallbackEvents.push({
            id: "auth-failures",
            type: "auth_failure",
            description: `${securityMetrics.auth.failedAttempts} failed login attempts`,
            timestamp: "Recent",
            severity: "warning",
          });
        }

        if (securityMetrics.apiKeys.expiring > 0) {
          fallbackEvents.push({
            id: "api-keys-expiring",
            type: "api_key_created",
            description: `${securityMetrics.apiKeys.expiring} API keys expiring soon`,
            timestamp: "This week",
            severity: "info",
          });
        }

        if (securityMetrics.secrets.expired > 0) {
          fallbackEvents.push({
            id: "secrets-expired",
            type: "secret_accessed",
            description: `${securityMetrics.secrets.expired} secrets have expired`,
            timestamp: "Current",
            severity: "critical",
          });
        }

        setRecentEvents(fallbackEvents);
      }
    } catch (err) {
      console.error("Failed to fetch security metrics:", err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Security & Access</h1>
        <p className="mt-2 text-muted-foreground">
          Manage API keys, secrets, roles, and user access control
        </p>
      </div>

      {/* Alert Banner - Shows security-related alerts */}
      <AlertBanner category="security" maxAlerts={3} />

      {/* Security Alerts based on metrics */}
      {metrics && metrics.auth.failedAttempts > 5 && (
        <div className="rounded-lg border border-orange-900/20 dark:border-orange-600/20 bg-orange-100 dark:bg-orange-950/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-orange-600 dark:text-orange-400">Security Alert</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {metrics.auth.failedAttempts} failed authentication attempts detected.
                <Link
                  href="/dashboard/security-access/audit"
                  className="ml-2 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
                >
                  Review security logs →
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SecurityMetricCard
          title="Security Score"
          value={`${metrics?.compliance.score || 0}/100`}
          subtitle={`${metrics?.compliance.issues || 0} issues`}
          icon={Shield}
          status={
            metrics?.compliance.score && metrics.compliance.score > 80 ? "success" : "warning"
          }
        />
        <SecurityMetricCard
          title="Active Sessions"
          value={metrics?.auth.activeSessions || 0}
          subtitle={`${metrics?.auth.passwordResets || 0} password resets`}
          icon={Users}
          status="success"
          href="/dashboard/security-access/users"
        />
        <SecurityMetricCard
          title="API Keys"
          value={metrics?.apiKeys.total || 0}
          subtitle={`${metrics?.apiKeys.expiring || 0} expiring soon`}
          icon={Key}
          status={metrics?.apiKeys.expiring && metrics.apiKeys.expiring > 0 ? "warning" : "success"}
          href="/dashboard/security-access/api-keys"
        />
        <SecurityMetricCard
          title="Secrets"
          value={metrics?.secrets.total || 0}
          subtitle={`${metrics?.secrets.rotated || 0} rotated recently`}
          icon={Lock}
          status={metrics?.secrets.expired && metrics.secrets.expired > 0 ? "danger" : "success"}
          href="/dashboard/security-access/secrets"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Security Events */}
          <SecurityEventLog events={recentEvents} />

          {/* Quick Actions */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Security Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/dashboard/security-access/api-keys"
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
              >
                <div className="p-2 bg-muted rounded-lg">
                  <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">API Keys</p>
                  <p className="text-sm text-muted-foreground">Manage API access</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link
                href="/dashboard/security-access/secrets"
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
              >
                <div className="p-2 bg-muted rounded-lg">
                  <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Secrets Vault</p>
                  <p className="text-sm text-muted-foreground">Secure credentials</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link
                href="/dashboard/security-access/roles"
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
              >
                <div className="p-2 bg-muted rounded-lg">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Roles & Permissions</p>
                  <p className="text-sm text-muted-foreground">Access control</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link
                href="/dashboard/security-access/users"
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
              >
                <div className="p-2 bg-muted rounded-lg">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">User Management</p>
                  <p className="text-sm text-muted-foreground">Users and teams</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>

        {/* Access Control Summary */}
        <div className="lg:col-span-1">
          {accessControlData && <AccessControlPanel data={accessControlData} />}
        </div>
      </div>
    </div>
  );
}
