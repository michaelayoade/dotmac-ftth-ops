/**
 * Team Notification Sender Page
 *
 * Send notifications to teams via role-based filtering or explicit user lists
 */

"use client";

import { useState } from "react";
import { Send, Users, AlertCircle, CheckCircle2, Loader2, Bell } from "lucide-react";
import {
  useTeamNotifications,
  AVAILABLE_ROLES,
  type TeamNotificationRequest,
} from "@/hooks/useTeamNotifications";
import type { NotificationPriority, NotificationType } from "@/hooks/useNotifications";
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
import { RadioGroup, RadioGroupItem } from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";
import { useRBAC } from "@/contexts/RBACContext";

type TargetMode = "role" | "users";

export default function TeamNotificationPage() {
  const { hasPermission } = useRBAC();
  const canWrite = hasPermission("notifications.write") || hasPermission("admin");

  const { sendTeamNotification, isLoading, error } = useTeamNotifications();

  // Form state
  const [targetMode, setTargetMode] = useState<TargetMode>("role");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [userIds, setUserIds] = useState<string>("");
  const [notificationType, setNotificationType] = useState<NotificationType>("system_announcement");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<NotificationPriority>("medium");
  const [actionUrl, setActionUrl] = useState("");
  const [actionLabel, setActionLabel] = useState("");

  // Success state
  const [successResponse, setSuccessResponse] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canWrite) {
      return;
    }

    try {
      setSuccessResponse(null);

      const request: TeamNotificationRequest = {
        title,
        message,
        priority,
        notification_type: notificationType,
        auto_send: true,
        ...(actionUrl ? { action_url: actionUrl } : {}),
        ...(actionLabel ? { action_label: actionLabel } : {}),
        ...(targetMode === "role"
          ? { role_filter: selectedRole }
          : {
              team_members: userIds
                .split(",")
                .map((id) => id.trim())
                .filter((id) => id.length > 0),
            }),
      };

      const response = await sendTeamNotification(request);
      setSuccessResponse(response);

      // Reset form
      setTitle("");
      setMessage("");
      setActionUrl("");
      setActionLabel("");
      setUserIds("");
    } catch (err) {
      // Error is handled by the hook
      console.error("Failed to send team notification:", err);
    }
  };

  const isFormValid = () => {
    if (!title.trim() || !message.trim()) return false;
    if (targetMode === "role" && !selectedRole) return false;
    if (targetMode === "users" && !userIds.trim()) return false;
    return true;
  };

  if (!canWrite) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don&apos;t have permission to send team notifications.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Bell className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          Team Notifications
        </h1>
        <p className="mt-2 text-muted-foreground">
          Send notifications to teams via role-based filtering or explicit user lists
        </p>
      </div>

      {/* Success Alert */}
      {successResponse && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle className="text-green-600 dark:text-green-400">
            Notification Sent Successfully
          </AlertTitle>
          <AlertDescription className="text-green-600 dark:text-green-400">
            {successResponse.notifications_created} notification(s) created for{" "}
            {successResponse.target_count} user(s)
            {successResponse.role_filter && ` with role "${successResponse.role_filter}"`}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Send Team Notification</CardTitle>
          <CardDescription>Select notification target and compose your message</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Target Mode Selection */}
            <div className="space-y-3">
              <Label>Target Mode</Label>
              <RadioGroup
                value={targetMode}
                onValueChange={(v: string) => setTargetMode(v as TargetMode)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="role" id="role" />
                  <Label htmlFor="role" className="font-normal cursor-pointer">
                    Notify by Role (e.g., all admins, all support agents)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="users" id="users" />
                  <Label htmlFor="users" className="font-normal cursor-pointer">
                    Notify Specific Users (comma-separated UUIDs)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Role Selection */}
            {targetMode === "role" && (
              <div className="space-y-2">
                <Label htmlFor="role-select">Select Role *</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger id="role-select">
                    <SelectValue placeholder="Choose a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  All active users with this role will receive the notification
                </p>
              </div>
            )}

            {/* User IDs */}
            {targetMode === "users" && (
              <div className="space-y-2">
                <Label htmlFor="user-ids">User IDs *</Label>
                <Textarea
                  id="user-ids"
                  value={userIds}
                  onChange={(e) => setUserIds(e.target.value)}
                  placeholder="uuid-1, uuid-2, uuid-3, ..."
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  Enter comma-separated user UUIDs. Each user will receive a notification.
                </p>
              </div>
            )}

            {/* Notification Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Notification Type *</Label>
              <Select
                value={notificationType}
                onValueChange={(v) => setNotificationType(v as NotificationType)}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system_announcement">System Announcement</SelectItem>
                  <SelectItem value="service_outage">Service Outage</SelectItem>
                  <SelectItem value="service_restored">Service Restored</SelectItem>
                  <SelectItem value="ticket_assigned">Ticket Assigned</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as NotificationPriority)}
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

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title..."
                maxLength={500}
                required
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Notification message..."
                rows={6}
                required
              />
            </div>

            {/* Action URL (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="action-url">Action URL (Optional)</Label>
              <Input
                id="action-url"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="/dashboard/tickets/TCK-123"
                type="url"
              />
              <p className="text-sm text-muted-foreground">
                Users will see a button linking to this URL
              </p>
            </div>

            {/* Action Label (Optional) */}
            {actionUrl && (
              <div className="space-y-2">
                <Label htmlFor="action-label">Action Button Label</Label>
                <Input
                  id="action-label"
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder="View Details"
                  maxLength={100}
                />
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="submit" disabled={!isFormValid() || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Team Notification
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <Users className="h-5 w-5" />
            How Team Notifications Work
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 dark:text-blue-200 space-y-2">
          <p>
            <strong>Role-Based:</strong> Notifications are sent to all active users with the
            selected role.
          </p>
          <p>
            <strong>User-Based:</strong> Notifications are sent to specific users by their UUIDs.
          </p>
          <p>
            <strong>Channels:</strong> Notifications are delivered via in-app, email, and other
            configured channels based on user preferences.
          </p>
          <p>
            <strong>Error Handling:</strong> If one user fails, notifications will still be sent to
            remaining users.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
