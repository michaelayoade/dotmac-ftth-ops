"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  Mail,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCommunicationStats, useCommunicationLogs } from "@/hooks/useCommunications";

interface EmailDisplay {
  id: string;
  subject: string;
  recipient: string;
  status: string;
  sentAt: Date;
}

/**
 * Communications Dashboard Component
 *
 * Provides overview of email communications, templates, and campaign statistics
 */
export function CommunicationsDashboard() {
  // Fetch real data from API using hooks
  const { data: statsData, isLoading: statsLoading } = useCommunicationStats();
  const { data: emailsData, isLoading: emailsLoading } = useCommunicationLogs({
    page: 1,
    page_size: 10,
    sort_by: "created_at",
    sort_order: "desc",
  });

  const stats = statsData
    ? {
        totalSent: statsData.total_sent,
        queued: statsData.by_status?.queued || 0,
        failed: statsData.total_failed,
        delivered: statsData.total_delivered,
        deliveryRate: statsData.delivery_rate,
        avgSendTime: 0, // Not available in current stats
      }
    : {
        totalSent: 0,
        queued: 0,
        failed: 0,
        delivered: 0,
        deliveryRate: 0,
        avgSendTime: 0,
      };

  const recentEmails: EmailDisplay[] =
    emailsData?.logs.map((log) => ({
      id: log.id,
      subject: log.subject || "No subject",
      recipient: log.recipient_email || "Unknown",
      status: log.status,
      sentAt: new Date(log.created_at),
    })) || [];

  const templates = [
    { id: "1", name: "Welcome Email", usageCount: 145 },
    { id: "2", name: "Payment Reminder", usageCount: 89 },
    { id: "3", name: "Service Update", usageCount: 67 },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "queued":
        return <Clock className="h-4 w-4 text-amber-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      delivered: "default",
      failed: "destructive",
      queued: "secondary",
    } as const;

    return <Badge variant={variants[status as keyof typeof variants] || "outline"}>{status}</Badge>;
  };

  const formatTime = (date: Date) => {
    const now = Date.now();
    const diff = now - date.getTime();
    const hours = Math.floor(diff / 3600000);

    if (hours < 1) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Communications</h2>
          <p className="text-sm text-muted-foreground">
            Email templates, campaigns, and delivery statistics
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/operations/communications/compose">
            <Send className="mr-2 h-4 w-4" />
            Send Email
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queued</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.queued}</div>
            <p className="text-xs text-muted-foreground">Pending delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deliveryRate}%</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent">Recent Emails</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Recent Emails Tab */}
        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Emails</CardTitle>
              <CardDescription>Latest email communications sent from your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentEmails.map((email: EmailDisplay) => (
                  <div
                    key={email.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(email.status)}
                      <div>
                        <p className="font-medium">{email.subject}</p>
                        <p className="text-sm text-muted-foreground">{email.recipient}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(email.status)}
                      <span className="text-sm text-muted-foreground">
                        {formatTime(email.sentAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-center">
                <Button variant="outline" asChild>
                  <Link href="/dashboard/operations/communications/history">View All Emails</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>Reusable email templates for common communications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Used {template.usageCount} times
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Use Template
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-center">
                <Button variant="outline" asChild>
                  <Link href="/dashboard/operations/communications/templates">
                    Manage Templates
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
              <CardDescription>Email performance metrics and insights</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Delivery Rate</span>
                    <span className="text-sm text-muted-foreground">{stats.deliveryRate}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${stats.deliveryRate}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground mb-1">Avg. Send Time</p>
                    <p className="text-2xl font-bold">{stats.avgSendTime}s</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground mb-1">Active Templates</p>
                    <p className="text-2xl font-bold">{templates.length}</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground text-center py-4">
                  Detailed analytics charts and reports will be displayed here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
