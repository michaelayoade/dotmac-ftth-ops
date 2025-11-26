/**
 * Bulk Notification Sender Page
 *
 * Admin page for sending bulk notifications to subscribers/customers
 * with filtering, template selection, and scheduling options.
 */

"use client";

import { useState, useMemo } from "react";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  useBulkNotifications,
  useNotificationTemplates,
  type BulkNotificationRequest,
  type NotificationChannel,
  type CommunicationType,
  type BulkNotificationResponse,
} from "@/hooks/useNotifications";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dotmac/ui";
import { Checkbox } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { ScrollArea } from "@dotmac/ui";
import { useRBAC } from "@/contexts/RBACContext";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

export default function BulkNotificationSenderPage() {
  const { toast } = useToast();
  const { hasPermission } = useRBAC();
  const canWrite = hasPermission("notifications.write") || hasPermission("admin");

  const { sendBulkNotification, isLoading } = useBulkNotifications();
  const { templates } = useNotificationTemplates({ activeOnly: true });

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [channels, setChannels] = useState<NotificationChannel[]>(["email"]);
  const [recipientFilter, setRecipientFilter] = useState({
    subscriberIds: "",
    customerIds: "",
    status: [] as string[],
    connectionType: [] as string[],
  });
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const [useCustomMessage, setUseCustomMessage] = useState(false);
  const [customMessage, setCustomMessage] = useState({
    title: "",
    message: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
  });

  // Job tracking
  const [sentJobs, setSentJobs] = useState<BulkNotificationResponse[]>([]);

  // Filter templates by selected channel
  const availableTemplates = useMemo(() => {
    if (channels.length === 0) return templates;

    // Map channels to template types
    const channelTypeMap: Record<NotificationChannel, CommunicationType[]> = {
      email: ["email"],
      sms: ["sms"],
      push: ["push"],
      webhook: ["webhook"],
      in_app: ["email"], // In-app can use any template
    };

    const allowedTypes = channels.flatMap((ch) => channelTypeMap[ch] || []);
    return templates.filter((t) => allowedTypes.includes(t.type));
  }, [templates, channels]);

  // Estimate recipient count
  const estimatedRecipients = useMemo(() => {
    let count = 0;
    if (recipientFilter.subscriberIds) {
      count += recipientFilter.subscriberIds.split(",").filter((id) => id.trim()).length;
    }
    if (recipientFilter.customerIds) {
      count += recipientFilter.customerIds.split(",").filter((id) => id.trim()).length;
    }
    // In a real app, you'd query the backend for the count based on filters
    return count > 0 ? count : "All subscribers";
  }, [recipientFilter]);

  const handleChannelToggle = (channel: NotificationChannel, checked: boolean) => {
    if (checked) {
      setChannels([...channels, channel]);
    } else {
      setChannels(channels.filter((c) => c !== channel));
    }
  };

  const handleStatusToggle = (status: string, checked: boolean) => {
    if (checked) {
      setRecipientFilter({
        ...recipientFilter,
        status: [...recipientFilter.status, status],
      });
    } else {
      setRecipientFilter({
        ...recipientFilter,
        status: recipientFilter.status.filter((s) => s !== status),
      });
    }
  };

  const handleConnectionTypeToggle = (type: string, checked: boolean) => {
    if (checked) {
      setRecipientFilter({
        ...recipientFilter,
        connectionType: [...recipientFilter.connectionType, type],
      });
    } else {
      setRecipientFilter({
        ...recipientFilter,
        connectionType: recipientFilter.connectionType.filter((t) => t !== type),
      });
    }
  };

  const handleSend = async () => {
    if (channels.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one channel",
        variant: "destructive",
      });
      return;
    }

    if (!useCustomMessage && !selectedTemplate) {
      toast({
        title: "Validation Error",
        description: "Please select a template or compose a custom message",
        variant: "destructive",
      });
      return;
    }

    const subscriberIds = recipientFilter.subscriberIds
      ? recipientFilter.subscriberIds.split(",").map((id) => id.trim())
      : undefined;
    const customerIds = recipientFilter.customerIds
      ? recipientFilter.customerIds.split(",").map((id) => id.trim())
      : undefined;
    const status = recipientFilter.status.length > 0 ? recipientFilter.status : undefined;
    const connectionType = recipientFilter.connectionType.length > 0 ? recipientFilter.connectionType : undefined;

    const recipientFiltersPresent =
      subscriberIds || customerIds || status || connectionType;

    const request: BulkNotificationRequest = {
      channels,
      ...(scheduleAt ? { schedule_at: scheduleAt } : {}),
      ...(recipientFiltersPresent && {
        recipient_filter: {
          ...(subscriberIds && { subscriber_ids: subscriberIds }),
          ...(customerIds && { customer_ids: customerIds }),
          ...(status && { status }),
          ...(connectionType && { connection_type: connectionType }),
        },
      }),
      ...(useCustomMessage
        ? {
            custom_notification: {
              user_id: "", // Will be set by backend per recipient
              type: "custom",
              title: customMessage.title,
              message: customMessage.message,
              priority: customMessage.priority,
              channels,
            },
          }
        : { template_id: selectedTemplate }),
    };

    try {
      const result = await sendBulkNotification(request);
      if (result) {
        setSentJobs([result, ...sentJobs]);

        logger.info("Bulk notification queued successfully", {
          jobId: result.job_id,
          totalRecipients: result.total_recipients,
          status: result.status,
          channels,
        });

        toast({
          title: "Success",
          description: `Notification queued successfully! Job ID: ${result.job_id} | Recipients: ${result.total_recipients}`,
        });

        // Reset form
        setSelectedTemplate("");
        setRecipientFilter({
          subscriberIds: "",
          customerIds: "",
          status: [],
          connectionType: [],
        });
        setScheduleAt("");
        setCustomMessage({ title: "", message: "", priority: "medium" });
      }
    } catch (err) {
      logger.error("Failed to send bulk notification", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send notification. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Permission check
  if (!canWrite) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don&apos;t have permission to send bulk notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please contact your administrator to request access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Send Bulk Notifications</h1>
        <p className="text-muted-foreground">
          Send notifications to multiple subscribers or customers at once
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Message Content */}
          <Card>
            <CardHeader>
              <CardTitle>Message Content</CardTitle>
              <CardDescription>Choose a template or compose a custom message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs
                value={useCustomMessage ? "custom" : "template"}
                onValueChange={(v) => setUseCustomMessage(v === "custom")}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="template">Use Template</TabsTrigger>
                  <TabsTrigger value="custom">Custom Message</TabsTrigger>
                </TabsList>

                <TabsContent value="template" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Template</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTemplates.length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground">
                            No templates available for selected channels
                          </div>
                        )}
                        {availableTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{template.type}</Badge>
                              <span>{template.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTemplate && (
                      <p className="text-xs text-muted-foreground">
                        {availableTemplates.find((t) => t.id === selectedTemplate)?.description}
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="custom" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={customMessage.title}
                      onChange={(e) =>
                        setCustomMessage({
                          ...customMessage,
                          title: e.target.value,
                        })
                      }
                      placeholder="e.g., Important Service Update"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={customMessage.message}
                      onChange={(e) =>
                        setCustomMessage({
                          ...customMessage,
                          message: e.target.value,
                        })
                      }
                      placeholder="Enter your message..."
                      rows={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={customMessage.priority}
                      onValueChange={(v: unknown) =>
                        setCustomMessage({ ...customMessage, priority: v as "low" | "medium" | "high" | "urgent" })
                      }
                    >
                      <SelectTrigger id="priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Channels */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Channels</CardTitle>
              <CardDescription>Select how you want to send the notification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="email"
                    checked={channels.includes("email")}
                    onChange={(e) => handleChannelToggle("email", e.target.checked)}
                  />
                  <Label htmlFor="email" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800">EMAIL</Badge>
                      <span>Send via email</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sms"
                    checked={channels.includes("sms")}
                    onChange={(e) => handleChannelToggle("sms", e.target.checked)}
                  />
                  <Label htmlFor="sms" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800">SMS</Badge>
                      <span>Send via SMS</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="in_app"
                    checked={channels.includes("in_app")}
                    onChange={(e) => handleChannelToggle("in_app", e.target.checked)}
                  />
                  <Label htmlFor="in_app" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-800">IN-APP</Badge>
                      <span>Show in notification center</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="push"
                    checked={channels.includes("push")}
                    onChange={(e) => handleChannelToggle("push", e.target.checked)}
                  />
                  <Label htmlFor="push" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-100 text-orange-800">PUSH</Badge>
                      <span>Browser push notification</span>
                    </div>
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipients */}
          <Card>
            <CardHeader>
              <CardTitle>Recipients</CardTitle>
              <CardDescription>Specify who should receive this notification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Subscriber IDs */}
              <div className="space-y-2">
                <Label htmlFor="subscriber-ids">Subscriber IDs (comma-separated)</Label>
                <Textarea
                  id="subscriber-ids"
                  value={recipientFilter.subscriberIds}
                  onChange={(e) =>
                    setRecipientFilter({
                      ...recipientFilter,
                      subscriberIds: e.target.value,
                    })
                  }
                  placeholder="e.g., sub_123, sub_456, sub_789"
                  rows={2}
                />
              </div>

              {/* Customer IDs */}
              <div className="space-y-2">
                <Label htmlFor="customer-ids">Customer IDs (comma-separated)</Label>
                <Textarea
                  id="customer-ids"
                  value={recipientFilter.customerIds}
                  onChange={(e) =>
                    setRecipientFilter({
                      ...recipientFilter,
                      customerIds: e.target.value,
                    })
                  }
                  placeholder="e.g., cus_123, cus_456, cus_789"
                  rows={2}
                />
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Filter by Subscriber Status</Label>
                <div className="space-y-2">
                  {["active", "suspended", "pending"].map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={recipientFilter.status.includes(status)}
                        onChange={(e) => handleStatusToggle(status, e.target.checked)}
                      />
                      <Label htmlFor={`status-${status}`} className="cursor-pointer capitalize">
                        {status}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connection Type Filter */}
              <div className="space-y-2">
                <Label>Filter by Connection Type</Label>
                <div className="space-y-2">
                  {["ftth", "wireless", "dsl"].map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type}`}
                        checked={recipientFilter.connectionType.includes(type)}
                        onChange={(e) => handleConnectionTypeToggle(type, e.target.checked)}
                      />
                      <Label htmlFor={`type-${type}`} className="cursor-pointer uppercase">
                        {type}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Leave filters empty to send to all subscribers
              </p>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Schedule (Optional)</CardTitle>
              <CardDescription>Schedule the notification for a specific time</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-at">Send At</Label>
                <Input
                  id="schedule-at"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Leave empty to send immediately</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary & Recent Jobs */}
        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Channels</span>
                  <span className="font-medium">{channels.length || "None"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Recipients</span>
                  <span className="font-medium">{estimatedRecipients}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium">{scheduleAt ? "Scheduled" : "Immediate"}</span>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleSend} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Notification
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Jobs</CardTitle>
              <CardDescription>Track your bulk notification jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {sentJobs.length === 0 && (
                  <p className="text-sm text-muted-foreground">No jobs yet</p>
                )}
                <div className="space-y-3">
                  {sentJobs.map((job) => (
                    <div key={job.job_id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground">
                          {job.job_id}
                        </span>
                        <JobStatusBadge status={job.status} />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Recipients</span>
                        <span className="font-medium">{job.total_recipients}</span>
                      </div>
                      {job.scheduled_at && (
                        <div className="text-xs text-muted-foreground">
                          Scheduled: {new Date(job.scheduled_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper component for job status badge
function JobStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    queued: { icon: Clock, className: "bg-blue-100 text-blue-800" },
    processing: { icon: Clock, className: "bg-yellow-100 text-yellow-800" },
    completed: { icon: CheckCircle2, className: "bg-green-100 text-green-800" },
    failed: { icon: AlertCircle, className: "bg-red-100 text-red-800" },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.queued;
  const Icon = config.icon;

  return (
    <Badge className={config.className}>
      <Icon className="mr-1 h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
