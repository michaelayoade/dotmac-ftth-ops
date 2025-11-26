/**
 * Communication Detail Modal
 *
 * Modal for viewing detailed information about a sent communication/notification.
 * Shows full content, metadata, delivery timeline, and retry options.
 */

"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
import { ScrollArea } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { formatDistanceToNow, format } from "date-fns";
import {
  Mail,
  MessageSquare,
  Bell,
  Webhook,
  Copy,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Calendar,
  User,
  Server,
  Hash,
  FileText,
} from "lucide-react";
import { useMemo, useState } from "react";

import { sanitizeRichHtml } from "../../utils/sanitize";

export interface CommunicationDetailModalProps<TLog = any> {
  isOpen: boolean;
  onClose: () => void;
  log: TLog;
  onRetry?: () => Promise<void>;
}

export function CommunicationDetailModal<TLog = any>({
  isOpen,
  onClose,
  log,
  onRetry,
}: CommunicationDetailModalProps<TLog>) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Cast log to access properties
  const logData = log as any;

  const sanitizedHtmlBody = useMemo(
    () => sanitizeRichHtml(logData.html_body || ""),
    [logData.html_body],
  );

  const handleCopy = (field: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
      onClose();
    } catch (err) {
      console.error("Failed to retry communication:", err);
    } finally {
      setIsRetrying(false);
    }
  };

  // Get type icon
  const getTypeIcon = () => {
    switch (logData.type) {
      case "email":
        return <Mail className="h-5 w-5" />;
      case "sms":
        return <MessageSquare className="h-5 w-5" />;
      case "push":
        return <Bell className="h-5 w-5" />;
      case "webhook":
        return <Webhook className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  // Get status badge
  const getStatusBadge = () => {
    const statusConfig = {
      pending: { variant: "secondary" as const, icon: Clock, label: "Pending" },
      sent: { variant: "default" as const, icon: CheckCircle2, label: "Sent" },
      delivered: {
        variant: "default" as const,
        icon: CheckCircle2,
        label: "Delivered",
      },
      failed: {
        variant: "destructive" as const,
        icon: XCircle,
        label: "Failed",
      },
      bounced: {
        variant: "destructive" as const,
        icon: AlertCircle,
        label: "Bounced",
      },
      cancelled: {
        variant: "outline" as const,
        icon: XCircle,
        label: "Cancelled",
      },
    };

    const config =
      statusConfig[logData.status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Can retry if failed or bounced
  const canRetry = ["failed", "bounced"].includes(logData.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">{getTypeIcon()}</div>
            <div className="flex-1">
              <DialogTitle>Communication Details</DialogTitle>
              <DialogDescription>
                {logData.type.toUpperCase()} • ID: {logData.id}
              </DialogDescription>
            </div>
            {getStatusBadge()}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Summary Card */}
            <div className="rounded-lg border bg-muted p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Recipient</p>
                  <p className="font-medium">{logData.recipient}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Provider</p>
                  <p className="font-medium">{logData.provider || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Sent At</p>
                  <p className="font-medium">
                    {logData.sent_at ? format(new Date(logData.sent_at), "PPpp") : "Not sent"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Retry Count</p>
                  <p className="font-medium">{logData.retry_count}</p>
                </div>
              </div>
            </div>

            {/* Error Message (if failed) */}
            {logData.error_message && (
              <div className="rounded-lg border border-destructive bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold text-destructive">Error Details</p>
                    <p className="text-sm text-muted-foreground">{logData.error_message}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery Timeline */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Delivery Timeline
              </h3>
              <div className="space-y-2 border-l-2 border-muted pl-4">
                <div className="relative">
                  <div className="absolute -left-[1.3rem] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(logData.created_at), "PPpp")} (
                    {formatDistanceToNow(new Date(logData.created_at), {
                      addSuffix: true,
                    })}
                    )
                  </p>
                </div>
                {logData.sent_at && (
                  <div className="relative">
                    <div className="absolute -left-[1.3rem] top-1 h-3 w-3 rounded-full border-2 border-background bg-blue-600" />
                    <p className="text-sm font-medium">Sent</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(logData.sent_at), "PPpp")} (
                      {formatDistanceToNow(new Date(logData.sent_at), {
                        addSuffix: true,
                      })}
                      )
                    </p>
                  </div>
                )}
                {logData.delivered_at && (
                  <div className="relative">
                    <div className="absolute -left-[1.3rem] top-1 h-3 w-3 rounded-full border-2 border-background bg-green-600" />
                    <p className="text-sm font-medium">Delivered</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(logData.delivered_at), "PPpp")} (
                      {formatDistanceToNow(new Date(logData.delivered_at), {
                        addSuffix: true,
                      })}
                      )
                    </p>
                  </div>
                )}
                {logData.failed_at && (
                  <div className="relative">
                    <div className="absolute -left-[1.3rem] top-1 h-3 w-3 rounded-full border-2 border-background bg-destructive" />
                    <p className="text-sm font-medium">Failed</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(logData.failed_at), "PPpp")} (
                      {formatDistanceToNow(new Date(logData.failed_at), {
                        addSuffix: true,
                      })}
                      )
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Content Tabs */}
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">
                  <FileText className="mr-2 h-4 w-4" />
                  Content
                </TabsTrigger>
                <TabsTrigger value="metadata">
                  <Hash className="mr-2 h-4 w-4" />
                  Metadata
                </TabsTrigger>
                <TabsTrigger value="raw">
                  <Server className="mr-2 h-4 w-4" />
                  Raw Data
                </TabsTrigger>
              </TabsList>

              {/* Content Tab */}
              <TabsContent value="content" className="space-y-4 mt-4">
                {/* Subject (Email/SMS) */}
                {logData.subject && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Subject</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy("subject", logData.subject || "")}
                      >
                        {copiedField === "subject" ? (
                          <>
                            <Check className="mr-1 h-3 w-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-3 w-3" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-sm font-medium">{logData.subject}</p>
                    </div>
                  </div>
                )}

                {/* Text Body */}
                {logData.text_body && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Text Body</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy("text", logData.text_body || "")}
                      >
                        {copiedField === "text" ? (
                          <>
                            <Check className="mr-1 h-3 w-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-3 w-3" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <p className="whitespace-pre-wrap text-sm">{logData.text_body}</p>
                    </div>
                    {logData.type === "sms" && (
                      <p className="text-xs text-muted-foreground">
                        Length: {logData.text_body.length} characters
                        {logData.text_body.length > 160 &&
                          ` (${Math.ceil(logData.text_body.length / 160)} SMS segments)`}
                      </p>
                    )}
                  </div>
                )}

                {/* HTML Body (Email only) */}
                {logData.type === "email" && logData.html_body && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">HTML Body</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy("html", logData.html_body || "")}
                      >
                        {copiedField === "html" ? (
                          <>
                            <Check className="mr-1 h-3 w-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-3 w-3" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <div
                        className="prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: sanitizedHtmlBody }}
                      />
                    </div>
                  </div>
                )}

                {/* No content message */}
                {!logData.subject && !logData.text_body && !logData.html_body && (
                  <div className="flex items-center justify-center rounded-lg border border-dashed p-8 text-center">
                    <p className="text-sm text-muted-foreground">No content available</p>
                  </div>
                )}
              </TabsContent>

              {/* Metadata Tab */}
              <TabsContent value="metadata" className="space-y-4 mt-4">
                <div className="grid gap-3">
                  <div className="grid grid-cols-3 gap-2 rounded-lg border p-3">
                    <p className="text-sm font-semibold">Type</p>
                    <p className="col-span-2 text-sm">{logData.type.toUpperCase()}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg border p-3">
                    <p className="text-sm font-semibold">Recipient</p>
                    <p className="col-span-2 text-sm font-mono">{logData.recipient}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg border p-3">
                    <p className="text-sm font-semibold">Provider</p>
                    <p className="col-span-2 text-sm">{logData.provider || "N/A"}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg border p-3">
                    <p className="text-sm font-semibold">Template</p>
                    <p className="col-span-2 text-sm">
                      {logData.template_name || "Custom Message"}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg border p-3">
                    <p className="text-sm font-semibold">User ID</p>
                    <p className="col-span-2 text-sm font-mono">{logData.user_id || "N/A"}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg border p-3">
                    <p className="text-sm font-semibold">Tenant ID</p>
                    <p className="col-span-2 text-sm font-mono">{logData.tenant_id}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg border p-3">
                    <p className="text-sm font-semibold">Status</p>
                    <div className="col-span-2">{getStatusBadge()}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg border p-3">
                    <p className="text-sm font-semibold">Retry Count</p>
                    <p className="col-span-2 text-sm">{logData.retry_count}</p>
                  </div>
                  {logData.metadata && Object.keys(logData.metadata).length > 0 && (
                    <div className="grid grid-cols-3 gap-2 rounded-lg border p-3">
                      <p className="text-sm font-semibold">Custom Metadata</p>
                      <div className="col-span-2 space-y-1">
                        {Object.entries(logData.metadata).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="font-mono text-muted-foreground">{key}:</span>{" "}
                            <span className="font-mono">{JSON.stringify(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Raw Data Tab */}
              <TabsContent value="raw" className="mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Raw JSON Data</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy("raw", JSON.stringify(log, null, 2))}
                    >
                      {copiedField === "raw" ? (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3 w-3" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="rounded-lg border bg-muted p-4">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(log, null, 2)}
                    </pre>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-between gap-2 pt-4 border-t">
          <div>
            {canRetry && onRetry && (
              <Button variant="outline" onClick={handleRetry} disabled={isRetrying}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Retrying..." : "Retry Delivery"}
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
