"use client";

import { useState, useEffect } from "react";
import {
  Mail,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  BarChart,
  AlertCircle,
  Webhook,
  RefreshCw,
  X,
  Inbox,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/components/ui/use-toast";
import { logger } from "@/lib/utils/logger";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface EmailStats {
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
}

interface RecentActivity {
  id: string;
  type: "email" | "webhook" | "sms";
  recipient: string;
  subject?: string;
  status: "sent" | "delivered" | "failed" | "pending";
  timestamp: string;
}

export function CommunicationsDashboard() {
  const { toast } = useToast();

  const [stats, setStats] = useState<EmailStats>({
    sent: 0,
    delivered: 0,
    failed: 0,
    pending: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageForm, setMessageForm] = useState({
    type: "email",
    recipient: "",
    subject: "",
    message: "",
  });

  useEffect(() => {
    fetchCommunicationData();
  }, []);

  const fetchCommunicationData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch stats from API
      const statsResponse = await apiClient.get<EmailStats>(
        "/api/v1/communications/stats",
      );

      if (statsResponse.data) {
        setStats(statsResponse.data);
      }

      // Fetch recent activity from API
      const activityResponse = await apiClient.get<RecentActivity[]>(
        "/api/v1/communications/activity?limit=20",
      );

      if (activityResponse.data) {
        setRecentActivity(activityResponse.data);
      }
    } catch (err) {
      logger.error(
        "Failed to fetch communication data",
        err instanceof Error ? err : new Error(String(err)),
      );
      setError("Failed to load communication data");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return (
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        );
      case "sent":
        return <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case "pending":
        return (
          <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        );
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (
    status: string,
  ):
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning"
    | "info" => {
    switch (status) {
      case "delivered":
        return "success";
      case "sent":
        return "info";
      case "failed":
        return "destructive";
      case "pending":
        return "warning";
      default:
        return "default";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="h-4 w-4 text-muted-foreground" />;
      case "webhook":
        return <Webhook className="h-4 w-4 text-muted-foreground" />;
      case "sms":
        return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">
          Loading communications data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Communications</h1>
        <Button onClick={() => setShowComposeModal(true)}>
          <Send className="h-4 w-4 mr-2" />
          Send Message
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {stats.sent.toLocaleString()}
                </p>
              </div>
              <Send className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Delivered</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {stats.delivered.toLocaleString()}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {stats.failed.toLocaleString()}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {stats.pending.toLocaleString()}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground text-lg font-medium">
                          No recent activity
                        </p>
                        <p className="text-muted-foreground/70 text-sm mt-2">
                          Communications will appear here once sent
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentActivity.map((activity) => (
                    <tr
                      key={activity.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(activity.type)}
                          <span className="text-sm text-foreground capitalize">
                            {activity.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-foreground">
                          {activity.recipient}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-foreground">
                          {activity.subject || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getStatusVariant(activity.status)}>
                          {activity.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-muted-foreground">
                          {formatTimestamp(activity.timestamp)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
          <CardContent className="p-6">
            <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-4" />
            <CardTitle className="text-lg mb-2">Email Templates</CardTitle>
            <CardDescription>Manage and create email templates</CardDescription>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
          <CardContent className="p-6">
            <Users className="h-8 w-8 text-green-600 dark:text-green-400 mb-4" />
            <CardTitle className="text-lg mb-2">Recipient Lists</CardTitle>
            <CardDescription>Manage recipient groups and lists</CardDescription>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
          <CardContent className="p-6">
            <BarChart className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-4" />
            <CardTitle className="text-lg mb-2">Analytics</CardTitle>
            <CardDescription>
              View detailed communication analytics
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Compose Message Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle>Compose Message</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowComposeModal(false)}
                  aria-label="Close compose modal"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>

            {/* Modal Content */}
            <CardContent className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Message Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Type
                </label>
                <select
                  value={messageForm.type}
                  onChange={(e) =>
                    setMessageForm({ ...messageForm, type: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>

              {/* Recipient */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {messageForm.type === "email"
                    ? "Email Address"
                    : messageForm.type === "sms"
                      ? "Phone Number"
                      : "Webhook URL"}
                </label>
                <input
                  type={messageForm.type === "email" ? "email" : "text"}
                  value={messageForm.recipient}
                  onChange={(e) =>
                    setMessageForm({
                      ...messageForm,
                      recipient: e.target.value,
                    })
                  }
                  placeholder={
                    messageForm.type === "email"
                      ? "recipient@example.com"
                      : messageForm.type === "sms"
                        ? "+1234567890"
                        : "https://api.example.com/webhook"
                  }
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>

              {/* Subject (for email only) */}
              {messageForm.type === "email" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={messageForm.subject}
                    onChange={(e) =>
                      setMessageForm({
                        ...messageForm,
                        subject: e.target.value,
                      })
                    }
                    placeholder="Enter subject"
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
              )}

              {/* Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {messageForm.type === "webhook"
                    ? "Payload (JSON)"
                    : "Message"}
                </label>
                <textarea
                  value={messageForm.message}
                  onChange={(e) =>
                    setMessageForm({ ...messageForm, message: e.target.value })
                  }
                  placeholder={
                    messageForm.type === "webhook"
                      ? '{\n  "event": "notification",\n  "data": {}\n}'
                      : "Enter your message here..."
                  }
                  rows={8}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent font-mono"
                />
              </div>
            </CardContent>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowComposeModal(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!messageForm.recipient) {
                    toast({
                      title: "Error",
                      description: "Please enter a recipient",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (messageForm.type === "email" && !messageForm.subject) {
                    toast({
                      title: "Error",
                      description: "Please enter a subject",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!messageForm.message) {
                    toast({
                      title: "Error",
                      description: "Please enter a message",
                      variant: "destructive",
                    });
                    return;
                  }

                  setSending(true);
                  try {
                    // Simulate API call
                    await new Promise((resolve) => setTimeout(resolve, 1500));

                    // Add to recent activity
                    const newActivity: RecentActivity = {
                      id: Date.now().toString(),
                      type: messageForm.type as any,
                      recipient: messageForm.recipient,
                      subject: messageForm.subject,
                      status: "sent",
                      timestamp: new Date().toISOString(),
                    };

                    setRecentActivity([newActivity, ...recentActivity]);
                    setStats({ ...stats, sent: stats.sent + 1 });

                    toast({
                      title: "Success",
                      description: `${messageForm.type === "email" ? "Email" : messageForm.type === "sms" ? "SMS" : "Webhook"} sent successfully`,
                    });
                    setShowComposeModal(false);
                    setMessageForm({
                      type: "email",
                      recipient: "",
                      subject: "",
                      message: "",
                    });
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to send message. Please try again.",
                      variant: "destructive",
                    });
                  } finally {
                    setSending(false);
                  }
                }}
                disabled={sending}
              >
                {sending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
