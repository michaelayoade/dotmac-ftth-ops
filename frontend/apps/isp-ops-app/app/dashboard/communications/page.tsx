"use client";

/**
 * Communications Dashboard Page
 *
 * Overview of email/SMS communications with stats, health, and recent activity.
 */

import { useState } from "react";
import Link from "next/link";
import { useCommunicationsDashboard } from "@/hooks/useCommunications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import {
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  Eye,
  MousePointerClick,
  Loader2,
  AlertCircle,
  FileText,
  Users,
  TrendingUp,
  Activity,
  RefreshCw,
} from "lucide-react";
import {
  getStatusColor,
  getStatusLabel,
  getTimeAgo,
  formatRate,
  type CommunicationStatus,
} from "@/types/communications";
import { RouteGuard } from "@/components/auth/PermissionGuard";

function CommunicationsDashboardContent() {
  const { stats, health, recentLogs, metrics, isLoading, error } = useCommunicationsDashboard();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load communications dashboard</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Communications</h1>
          <p className="text-muted-foreground mt-1">
            Manage email, SMS, and messaging across your platform
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/dashboard/communications/send">
            <Button>
              <Send className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          </Link>
        </div>
      </div>

      {/* Health Status */}
      {health && !health.smtp_available && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            SMTP service is unavailable. Email sending is currently disabled.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_sent?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Delivery rate: {formatRate(stats?.delivery_rate || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.total_delivered?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.total_sent ? Math.round((stats.total_delivered / stats.total_sent) * 100) : 0}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opened</CardTitle>
            <Eye className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.total_opened?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Open rate: {formatRate(stats?.open_rate || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clicked</CardTitle>
            <MousePointerClick className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats?.total_clicked?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Click rate: {formatRate(stats?.click_rate || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Health & Templates */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
            <CardDescription>Communication service status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">SMTP Service</span>
              {health?.smtp_available ? (
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">Unavailable</Badge>
              )}
            </div>
            {health?.smtp_available && health.smtp_host && (
              <p className="text-xs text-muted-foreground">
                {health.smtp_host}:{health.smtp_port}
              </p>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm">Redis Cache</span>
              {health?.redis_available ? (
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              ) : (
                <Badge className="bg-yellow-100 text-yellow-800">Unavailable</Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Celery Workers</span>
              {health?.celery_available ? (
                <Badge className="bg-green-100 text-green-800">
                  {health.active_workers || 0} Active
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">Unavailable</Badge>
              )}
            </div>

            {health?.celery_available && (
              <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Pending tasks:</span>
                  <span>{health.pending_tasks || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed tasks:</span>
                  <span>{health.failed_tasks || 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Top Templates
            </CardTitle>
            <CardDescription>Most used email templates</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics?.top_templates && metrics.top_templates.length > 0 ? (
              <div className="space-y-3">
                {metrics.top_templates.slice(0, 5).map((template) => (
                  <div key={template.template_id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{template.template_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.usage_count} uses • {template.success_rate.toFixed(1)}% success
                      </p>
                    </div>
                    <Link href={`/dashboard/communications/templates/${template.template_id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                ))}
                <Link href="/dashboard/communications/templates">
                  <Button variant="outline" className="w-full mt-2">
                    View All Templates
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No templates yet</p>
                <Link href="/dashboard/communications/templates/new">
                  <Button variant="outline" size="sm" className="mt-3">
                    Create Template
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest communications sent</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLogs && recentLogs.length > 0 ? (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between border-b pb-3 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getStatusColor(log["status"] as CommunicationStatus)}>
                        {getStatusLabel(log["status"] as CommunicationStatus)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{log.channel}</span>
                    </div>
                    <p className="text-sm font-medium truncate">
                      To: {log.recipient_email || log.recipient_phone}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{log.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getTimeAgo(log.created_at)}
                    </p>
                  </div>
                  <Link href={`/dashboard/communications/history/${log.id}`}>
                    <Button variant="ghost" size="sm">
                      Details
                    </Button>
                  </Link>
                </div>
              ))}
              <Link href="/dashboard/communications/history">
                <Button variant="outline" className="w-full mt-2">
                  View Full History
                </Button>
              </Link>
            </div>
          ) : (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No communications sent yet</p>
              <Link href="/dashboard/communications/send">
                <Button variant="outline" size="sm" className="mt-3">
                  <Send className="h-4 w-4 mr-2" />
                  Send Your First Email
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Failures */}
      {metrics?.recent_failures && metrics.recent_failures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Recent Failures
            </CardTitle>
            <CardDescription>Communications that failed to send</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.recent_failures.slice(0, 5).map((failure) => (
                <div
                  key={failure.log_id}
                  className="flex items-start justify-between border-b pb-3 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{failure.recipient}</p>
                    <p className="text-sm text-red-600 truncate">{failure.error_message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getTimeAgo(failure.failed_at)}
                    </p>
                  </div>
                  <Link href={`/dashboard/communications/history/${failure.log_id}`}>
                    <Button variant="ghost" size="sm">
                      Details
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common communication tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <Link href="/dashboard/communications/send">
              <Button variant="outline" className="w-full justify-start">
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </Button>
            </Link>
            <Link href="/dashboard/communications/bulk">
              <Button variant="outline" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Bulk Campaign
              </Button>
            </Link>
            <Link href="/dashboard/communications/templates/new">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CommunicationsDashboard() {
  return (
    <RouteGuard permission="communications.read">
      <CommunicationsDashboardContent />
    </RouteGuard>
  );
}
