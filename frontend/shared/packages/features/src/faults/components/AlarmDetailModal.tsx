/**
 * AlarmDetailModal Component
 *
 * A comprehensive modal for viewing and managing alarm details including:
 * - Alarm header with status and severity
 * - Detailed alarm information
 * - History timeline
 * - Actions (acknowledge, clear, create ticket)
 * - Related tickets
 * - Notes and comments
 * - Export functionality
 */

"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { ScrollArea } from "@dotmac/ui";
import { format } from "date-fns";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  User,
  MapPin,
  Tag,
  Calendar,
  Hash,
  FileText,
  Download,
  ExternalLink,
  MessageSquare,
  Activity,
  Bell,
  X,
  Edit,
  Save,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export type AlarmSeverity = "critical" | "major" | "minor" | "warning" | "info";
export type AlarmStatus = "active" | "acknowledged" | "cleared" | "resolved";

export interface AlarmHistory {
  id: string;
  timestamp: string;
  action: string;
  user?: string;
  details?: string;
  previous_status?: AlarmStatus;
  new_status?: AlarmStatus;
}

export interface AlarmNote {
  id: string;
  alarm_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface RelatedTicket {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  assigned_to?: string;
}

export interface AlarmDetailModalProps<TAlarm = any> {
  alarm: TAlarm | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;

  // Data props
  history?: AlarmHistory[];
  notes?: AlarmNote[];
  relatedTickets?: RelatedTicket[];
  isLoading?: boolean;

  // Action callbacks
  onAcknowledge?: (alarmId: string) => Promise<void>;
  onClear?: (alarmId: string) => Promise<void>;
  onCreateTicket?: (alarmId: string) => Promise<void>;
  onAddNote?: (alarmId: string, content: string) => Promise<void>;
  onFetchDetails?: (alarmId: string) => Promise<void>;
}

// ============================================================================
// Utility Functions
// ============================================================================

const getSeverityColor = (severity: AlarmSeverity): string => {
  const colors: Record<AlarmSeverity, string> = {
    critical: "bg-red-500",
    major: "bg-orange-500",
    minor: "bg-yellow-500",
    warning: "bg-blue-500",
    info: "bg-gray-500",
  };
  return colors[severity] || "bg-gray-500";
};

const getSeverityIcon = (severity: AlarmSeverity) => {
  const icons: Record<AlarmSeverity, React.ReactNode> = {
    critical: <AlertTriangle className="h-5 w-5" />,
    major: <AlertCircle className="h-5 w-5" />,
    minor: <Info className="h-5 w-5" />,
    warning: <Bell className="h-5 w-5" />,
    info: <Info className="h-5 w-5" />,
  };
  return icons[severity] || <Info className="h-5 w-5" />;
};

const getStatusColor = (status: AlarmStatus): string => {
  const colors: Record<AlarmStatus, string> = {
    active: "bg-red-100 text-red-800 border-red-200",
    acknowledged: "bg-yellow-100 text-yellow-800 border-yellow-200",
    cleared: "bg-blue-100 text-blue-800 border-blue-200",
    resolved: "bg-green-100 text-green-800 border-green-200",
  };
  return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
};

const formatDuration = (start: string, end?: string): string => {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const durationMs = endDate.getTime() - startDate.getTime();

  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

// ============================================================================
// Main Component
// ============================================================================

export function AlarmDetailModal<TAlarm = any>({
  alarm,
  open,
  onClose,
  onUpdate,
  history = [],
  notes = [],
  relatedTickets = [],
  isLoading = false,
  onAcknowledge,
  onClear,
  onCreateTicket,
  onAddNote,
  onFetchDetails,
}: AlarmDetailModalProps<TAlarm>) {
  const [activeTab, setActiveTab] = useState("details");
  const [newNote, setNewNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Cast alarm to access properties (since it's generic)
  const alarmData = alarm as any;

  // Fetch alarm details when modal opens
  useEffect(() => {
    if (open && alarm && onFetchDetails) {
      onFetchDetails(alarmData.id);
    }
  }, [alarm, open, onFetchDetails, alarmData?.id]);

  const handleAcknowledge = async () => {
    if (!alarm || !onAcknowledge) return;

    try {
      await onAcknowledge(alarmData.id);
      onUpdate?.();
    } catch (error) {
      console.error("Failed to acknowledge alarm:", error);
    }
  };

  const handleClear = async () => {
    if (!alarm || !onClear) return;

    try {
      await onClear(alarmData.id);
      onUpdate?.();
    } catch (error) {
      console.error("Failed to clear alarm:", error);
    }
  };

  const handleCreateTicket = async () => {
    if (!alarm || !onCreateTicket) return;

    try {
      await onCreateTicket(alarmData.id);
      onUpdate?.();
    } catch (error) {
      console.error("Failed to create ticket:", error);
    }
  };

  const handleAddNote = async () => {
    if (!alarm || !newNote.trim() || !onAddNote) return;

    setIsSavingNote(true);
    try {
      await onAddNote(alarmData.id, newNote);
      setNewNote("");
    } catch (error) {
      console.error("Failed to add note:", error);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleExport = () => {
    if (!alarmData) return;

    const data = {
      alarm,
      history,
      notes,
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alarm-${alarmData.alarm_id}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!alarm) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${getSeverityColor(alarmData.severity)}`}>
                  <div className="text-white">{getSeverityIcon(alarmData.severity)}</div>
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">{alarmData.title}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="font-mono text-xs">
                      {alarmData.alarm_id}
                    </Badge>
                    <Badge className={getStatusColor(alarmData.status)}>
                      {alarmData.status.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {alarmData.source.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Quick Actions */}
        <div className="flex gap-2 py-2">
          {alarmData.status === "active" && (
            <Button size="sm" variant="outline" onClick={handleAcknowledge}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Acknowledge
            </Button>
          )}
          {(alarmData.status === "active" || alarmData.status === "acknowledged") && (
            <Button size="sm" variant="outline" onClick={handleClear}>
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
          {!alarmData.ticket_id && (
            <Button size="sm" variant="outline" onClick={handleCreateTicket}>
              <FileText className="h-4 w-4 mr-2" />
              Create Ticket
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onFetchDetails?.(alarmData.id)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Separator />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">
              History
              {history.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {history.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notes">
              Notes
              {notes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {notes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="related">Related</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-0">
              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>First Occurrence</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium">
                      {format(new Date(alarmData.first_occurrence), "PPp")}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Last Occurrence</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium">
                      {format(new Date(alarmData.last_occurrence), "PPp")}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Duration</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium">
                      {formatDuration(alarmData.first_occurrence, alarmData.cleared_at)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Occurrences</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium">{alarmData.occurrence_count}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Alarm Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Alarm Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {alarmData.description && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <p className="text-sm mt-1">{alarmData.description}</p>
                    </div>
                  )}
                  {alarmData.message && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Message</Label>
                      <p className="text-sm mt-1 font-mono bg-muted p-2 rounded">
                        {alarmData.message}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Alarm Type</Label>
                      <p className="text-sm mt-1 font-medium">{alarmData.alarm_type}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Severity</Label>
                      <div className="mt-1">
                        <Badge className={getSeverityColor(alarmData.severity)}>
                          {alarmData.severity.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resource Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resource Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    {alarmData.resource_type && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Resource Type</Label>
                        <p className="text-sm mt-1 font-medium">{alarmData.resource_type}</p>
                      </div>
                    )}
                    {alarmData.resource_name && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Resource Name</Label>
                        <p className="text-sm mt-1 font-mono">{alarmData.resource_name}</p>
                      </div>
                    )}
                    {alarmData.resource_id && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Resource ID</Label>
                        <p className="text-sm mt-1 font-mono text-xs">{alarmData.resource_id}</p>
                      </div>
                    )}
                    {alarmData.customer_name && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Customer</Label>
                        <p className="text-sm mt-1 font-medium">{alarmData.customer_name}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Affected Subscribers</Label>
                    <p className="text-sm mt-1 font-medium">{alarmData.subscriber_count}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Root Cause Analysis */}
              {(alarmData.is_root_cause ||
                alarmData.probable_cause ||
                alarmData.recommended_action) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Root Cause Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {alarmData.is_root_cause && (
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">Root Cause</Badge>
                        <span className="text-sm text-muted-foreground">
                          This is identified as a root cause alarm
                        </span>
                      </div>
                    )}
                    {alarmData.probable_cause && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Probable Cause</Label>
                        <p className="text-sm mt-1">{alarmData.probable_cause}</p>
                      </div>
                    )}
                    {alarmData.recommended_action && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Recommended Action</Label>
                        <p className="text-sm mt-1">{alarmData.recommended_action}</p>
                      </div>
                    )}
                    {alarmData.correlation_id && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Correlation ID</Label>
                        <p className="text-sm mt-1 font-mono text-xs">{alarmData.correlation_id}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Metadata */}
              {Object.keys(alarmData.metadata || {}).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Metadata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                      {JSON.stringify(alarmData.metadata, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-4 mt-0">
              {history.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No history available</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {history.map((entry, index) => (
                    <Card key={entry.id}>
                      <CardContent className="pt-6">
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Activity className="h-4 w-4 text-primary" />
                            </div>
                            {index < history.length - 1 && (
                              <div className="h-full w-0.5 bg-border mt-2" />
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{entry.action}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(entry.timestamp), "PPp")}
                              </p>
                            </div>
                            {entry.details && (
                              <p className="text-sm text-muted-foreground">{entry.details}</p>
                            )}
                            {entry.user && (
                              <p className="text-xs text-muted-foreground">by {entry.user}</p>
                            )}
                            {entry.previous_status && entry.new_status && (
                              <div className="flex items-center gap-2 mt-2">
                                <Badge
                                  variant="outline"
                                  className={getStatusColor(entry.previous_status)}
                                >
                                  {entry.previous_status}
                                </Badge>
                                <span className="text-muted-foreground">→</span>
                                <Badge
                                  variant="outline"
                                  className={getStatusColor(entry.new_status)}
                                >
                                  {entry.new_status}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-4 mt-0">
              {/* Add Note Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add Note</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Enter your note here..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || isSavingNote}
                    size="sm"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSavingNote ? "Saving..." : "Add Note"}
                  </Button>
                </CardContent>
              </Card>

              {/* Existing Notes */}
              {notes.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No notes yet</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <Card key={note.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <p className="text-sm font-medium">{note.user_name}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(note.created_at), "PPp")}
                            </p>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Related Tab */}
            <TabsContent value="related" className="space-y-4 mt-0">
              {/* Related Tickets */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Related Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  {relatedTickets.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No related tickets</p>
                      {!alarmData.ticket_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={handleCreateTicket}
                        >
                          Create Ticket
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {relatedTickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{ticket.ticket_number}</p>
                              <Badge variant="outline">{ticket.status}</Badge>
                              <Badge variant="secondary">{ticket.priority}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{ticket.title}</p>
                            {ticket.assigned_to && (
                              <p className="text-xs text-muted-foreground">
                                Assigned to: {ticket.assigned_to}
                              </p>
                            )}
                          </div>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Correlated Alarms */}
              {alarmData.correlation_id && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Correlated Alarms</CardTitle>
                    <CardDescription>Correlation ID: {alarmData.correlation_id}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Correlation data will be loaded here
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
