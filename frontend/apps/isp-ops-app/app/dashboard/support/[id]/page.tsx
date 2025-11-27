"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Edit,
  User,
  Clock,
  Calendar,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Circle,
  XCircle,
} from "lucide-react";
import { Button } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  useTicket,
  useAddMessage,
  useUpdateTicket,
  type TicketStatus,
  type TicketPriority,
  type TicketMessage,
} from "@/hooks/useTicketing";

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params["id"] as string;

  const { ticket, loading, refetch } = useTicket(ticketId, true);
  const { addMessage, loading: sendingMessage } = useAddMessage();
  const { updateTicket, loading: updatingTicket } = useUpdateTicket();

  const [newMessage, setNewMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const result = await addMessage(ticketId, {
      message: newMessage,
    });

    if (result) {
      setNewMessage("");
      refetch();
    }
  };

  const handleUpdateStatus = async (status: TicketStatus) => {
    const result = await updateTicket(ticketId, { status });
    if (result) {
      refetch();
    }
  };

  const handleUpdatePriority = async (priority: TicketPriority) => {
    const result = await updateTicket(ticketId, { priority });
    if (result) {
      refetch();
    }
  };

  if (loading && !ticket) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading ticket...</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Ticket not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/support")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{ticket.ticket_number}</h1>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{ticket.subject}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Messages */}
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
              <CardDescription>
                {ticket.messages.length} message
                {ticket.messages.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticket.messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No messages yet</div>
              ) : (
                <div className="space-y-4">
                  {ticket.messages.map((message, index) => (
                    <MessageCard key={message.id} message={message} isFirst={index === 0} />
                  ))}
                </div>
              )}

              <Separator />

              {/* Reply Form */}
              {ticket.status !== "closed" && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Add Reply</label>
                  <Textarea
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={4}
                    disabled={sendingMessage}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSendMessage}
                      disabled={sendingMessage || !newMessage.trim()}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Priority */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ticket Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={ticket.status}
                  onValueChange={(v) => handleUpdateStatus(v as TicketStatus)}
                  disabled={updatingTicket || !isEditing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select
                  value={ticket.priority}
                  onValueChange={(v) => handleUpdatePriority(v as TicketPriority)}
                  disabled={updatingTicket || !isEditing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Ticket Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {ticket.ticket_type && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="font-medium">Type</div>
                    <div className="text-muted-foreground capitalize">
                      {ticket.ticket_type.replace(/_/g, " ")}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium">Created</div>
                  <div className="text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {ticket.last_response_at && (
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="font-medium">Last Update</div>
                    <div className="text-muted-foreground">
                      {new Date(ticket.last_response_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {ticket.service_address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="font-medium">Service Address</div>
                    <div className="text-muted-foreground">{ticket.service_address}</div>
                  </div>
                </div>
              )}

              {ticket.affected_services.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Affected Services</div>
                  <div className="flex flex-wrap gap-1">
                    {ticket.affected_services.map((service) => (
                      <Badge key={service} variant="outline" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {ticket.sla_breached && (
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <div className="font-medium">SLA Breached</div>
                    {ticket.sla_due_date && (
                      <div className="text-xs">
                        Due: {new Date(ticket.sla_due_date).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {ticket.resolution_time_minutes && (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <div className="font-medium">Resolution Time</div>
                    <div className="text-muted-foreground">
                      {Math.floor(ticket.resolution_time_minutes / 60)}h{" "}
                      {ticket.resolution_time_minutes % 60}m
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Components
// ============================================================================

interface MessageCardProps {
  message: TicketMessage;
  isFirst: boolean;
}

function MessageCard({ message, isFirst }: MessageCardProps) {
  const isSystem = message.sender_type === "platform";
  const isCustomer = message.sender_type === "customer";

  return (
    <div className={`${isFirst ? "border-l-4 border-primary pl-4" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium capitalize">{message.sender_type}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(message.created_at).toLocaleString()}
            </span>
            {isFirst && (
              <Badge variant="outline" className="text-xs">
                Initial Message
              </Badge>
            )}
          </div>
          <div className="text-sm text-foreground whitespace-pre-wrap">{message.body}</div>
          {message.attachments.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {message.attachments.length} attachment
              {message.attachments.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const variants: Record<TicketStatus, { variant: any; label: string; icon: any }> = {
    open: { variant: "default", label: "Open", icon: Circle },
    in_progress: { variant: "secondary", label: "In Progress", icon: Clock },
    waiting: { variant: "outline", label: "Waiting", icon: Clock },
    resolved: { variant: "success", label: "Resolved", icon: CheckCircle2 },
    closed: { variant: "secondary", label: "Closed", icon: XCircle },
  };

  const config = variants[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant as any}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const variants: Record<TicketPriority, { variant: any; label: string }> = {
    low: { variant: "outline", label: "Low" },
    normal: { variant: "secondary", label: "Normal" },
    high: { variant: "default", label: "High" },
    urgent: { variant: "destructive", label: "Urgent" },
  };

  const config = variants[priority];

  return <Badge variant={config.variant as any}>{config.label}</Badge>;
}
